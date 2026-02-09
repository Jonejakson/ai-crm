import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { validateRequest, createUserSchema } from "@/lib/validation"
import { isEmailConfigured, sendEmail } from "@/lib/email"

// В production НЕ загружаем dotenv - используем переменные из Docker/системы
// Загружаем переменные окружения только в development
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config()
  } catch (e) {
    // Игнорируем ошибки загрузки dotenv
  }
}

export async function POST(req: Request) {
  try {
    // Динамический импорт Prisma для избежания ошибок при загрузке модуля
    const { default: prisma } = await import("@/lib/init-prisma")

    // Дополнительная проверка DATABASE_URL
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL отсутствует в POST handler')
      return NextResponse.json(
        { error: "Ошибка конфигурации сервера: DATABASE_URL не установлен" },
        { status: 500 }
      )
    }

    const body = await req.json()

    // Предобработка данных: очистка телефона и ИНН от форматирования
    if (body.phone) {
      body.phone = body.phone.replace(/\s|\(|\)|-/g, '')
    }
    if (body.inn) {
      body.inn = body.inn.replace(/\s/g, '')
    }

    // Валидация с помощью Zod
    const validation = validateRequest(createUserSchema, body)
    
    if (validation instanceof NextResponse) {
      return validation // Возвращаем ошибку валидации
    }
    
    const { email, password, name, lastName, phone, companyId, userType, companyName, inn } = validation

    // Проверка существования пользователя
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 409 }
      )
    }

    // Хеширование пароля
    const hashedPassword = await bcrypt.hash(password, 10)

    // Определяем, создается ли новая компания или пользователь присоединяется к существующей
    let finalCompanyId: number | undefined = companyId;
    let isNewCompany = false;
    
    // Создание пользователя и подписки в транзакции
    const result = await prisma.$transaction(async (tx) => {
      // Создаем компанию ТОЛЬКО для юр лиц
      if (!finalCompanyId && userType === 'legal' && companyName) {
        const company = await tx.company.create({
          data: {
            name: companyName,
            inn: inn || null,
            isLegalEntity: true,
          },
        });
        finalCompanyId = company.id;
        isNewCompany = true;
      }
      
      // Для физ лиц используем общую компанию "Физ лица" (или создаем если нет)
      if (!finalCompanyId && userType === 'individual') {
        const defaultCompany = await tx.company.findFirst({
          where: { 
            name: 'Физ лица',
            isLegalEntity: false 
          }
        });
        
        if (defaultCompany) {
          finalCompanyId = defaultCompany.id;
        } else {
          // Создаем общую компанию для физ лиц
          const company = await tx.company.create({
            data: {
              name: 'Физ лица',
              isLegalEntity: false,
            },
          });
          finalCompanyId = company.id;
        }
      }

      // Убеждаемся, что finalCompanyId определен (обязательное поле в схеме)
      if (!finalCompanyId) {
        throw new Error('Не удалось определить компанию для пользователя')
      }

      // TypeScript guard - теперь finalCompanyId точно number
      const companyIdForUser: number = finalCompanyId;

      // Проверяем, есть ли уже пользователи в компании
      const existingUsersCount = await tx.user.count({
        where: { companyId: companyIdForUser }
      })

      // Если это новая компания или первый пользователь - делаем его админом
      const userRole = (isNewCompany || existingUsersCount === 0) ? 'admin' : 'user'
      
      // Логирование для отладки
      console.log('🔍 Registration debug:', {
        email,
        isNewCompany,
        finalCompanyId,
        existingUsersCount,
        userRole,
        userType,
        name,
        lastName
      })

      // Нужно ли подтверждение email: любой админ при регистрации (юр или физ лицо)
      const needsEmailVerification = userRole === 'admin' // Первый в компании = админ = требуется подтверждение
      const verificationToken = needsEmailVerification ? crypto.randomBytes(32).toString('hex') : null
      const verificationExpires = needsEmailVerification ? new Date(Date.now() + 48 * 60 * 60 * 1000) : null // 48 часов

      // Создание пользователя
      const user = await tx.user.create({
        data: {
          email,
          name: name.trim(), // Только имя
          lastName: lastName ? lastName.trim() : null, // Фамилия отдельно
          password: hashedPassword,
          phone: phone || null,
          companyId: companyIdForUser, // Теперь всегда определен как number
          role: userRole,
          emailVerifiedAt: needsEmailVerification ? null : new Date(), // Сразу подтверждён если не требуется
          emailVerificationToken: verificationToken,
          emailVerificationExpires: verificationExpires,
        },
        select: {
          id: true,
          email: true,
          name: true,
          lastName: true,
          phone: true,
          role: true,
          companyId: true,
        }
      })

      // Подписку создаем при первом входе пользователя (старт пробного периода с первого входа)

      return { user, needsEmailVerification, verificationToken }
    })

    // Отправка письма с подтверждением (только для админа при регистрации компании)
    if (result.needsEmailVerification && result.verificationToken && isEmailConfigured()) {
      try {
        const verifyUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/verify-email?token=${result.verificationToken}`
        await sendEmail({
          to: result.user.email,
          subject: 'Подтвердите email — Flame CRM',
          html: `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>Подтверждение email</h2>
                <p>Здравствуйте, ${result.user.name}!</p>
                <p>Вы зарегистрировались в Flame CRM. Для завершения регистрации подтвердите ваш email, нажав на кнопку ниже:</p>
                <p><a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">Подтвердить email</a></p>
                <p>Или скопируйте ссылку в браузер:</p>
                <p style="word-break: break-all; font-size: 12px; color: #666;">${verifyUrl}</p>
                <p><strong>Ссылка действительна 48 часов.</strong></p>
                <p>С уважением,<br>Команда Flame CRM</p>
              </div>
            </body>
            </html>
          `,
          text: `Подтвердите email: ${verifyUrl}\n\nСсылка действительна 48 часов.`,
        })
      } catch (emailErr: any) {
        console.error('[register] Failed to send verification email:', emailErr)
      }
    }

    return NextResponse.json(
      { 
        message: result.needsEmailVerification 
          ? "Регистрация прошла успешно. Проверьте email — на него отправлена ссылка для подтверждения. После подтверждения вы сможете войти в систему."
          : "Пользователь успешно создан",
        user: result.user,
        needsEmailVerification: result.needsEmailVerification,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("Registration error:", error)
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    })
    
    // Проверяем, является ли это ошибкой Prisma о DATABASE_URL
    if (error.message && (error.message.includes('postgresql://') || error.message.includes('postgres://') || error.message.includes('DATABASE_URL'))) {
      console.error('❌ Ошибка DATABASE_URL:', error.message)
      return NextResponse.json(
        { 
          error: "Ошибка подключения к базе данных. Проверьте настройки DATABASE_URL в .env файле.",
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        },
        { status: 500 }
      )
    }
    
    // Обработка специфичных ошибок Prisma
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 409 }
      )
    }
    
    // Более информативное сообщение об ошибке
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? `Ошибка: ${error.message || 'Неизвестная ошибка'}`
      : "Ошибка при регистрации. Попробуйте позже."
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
