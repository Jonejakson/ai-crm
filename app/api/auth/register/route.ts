import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { validateRequest, createUserSchema } from "@/lib/validation"

// Загружаем переменные окружения ПЕРЕД импортом Prisma
if (typeof window === 'undefined') {
  try {
    require('dotenv').config()
  } catch (e) {
    // dotenv уже загружен
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

    // Валидация с помощью Zod
    const validation = validateRequest(createUserSchema, body)
    
    if (validation instanceof NextResponse) {
      return validation // Возвращаем ошибку валидации
    }
    
    const { email, password, name, companyId } = validation

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

    // Создаем компанию для нового пользователя (или используем существующую, если передан companyId)
    let finalCompanyId = companyId;
    
    if (!finalCompanyId) {
      // Создаем новую компанию
      const company = await prisma.company.create({
        data: {
          name: `${name}'s Company`,
        },
      });
      finalCompanyId = company.id;
    }

    // Создание пользователя
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        companyId: finalCompanyId,
        role: 'user', // По умолчанию обычный пользователь
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
      }
    })

    return NextResponse.json(
      { message: "Пользователь успешно создан", user },
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
