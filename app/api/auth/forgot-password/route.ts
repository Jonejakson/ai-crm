import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { isEmailConfigured, sendEmail } from '@/lib/email'
import crypto from 'crypto'

/**
 * Запрос на восстановление пароля
 * POST /api/auth/forgot-password
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email обязателен' },
        { status: 400 }
      )
    }

    // Проверяем, что пользователь существует
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    // Для безопасности всегда возвращаем успех, даже если пользователь не найден
    // Это предотвращает перебор email'ов
    if (!user) {
      return NextResponse.json({
        message: 'Если пользователь с таким email существует, на него будет отправлено письмо с инструкциями',
      })
    }

    // Генерируем токен восстановления
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 часа

    // Сохраняем токен в базе данных
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    })

    // Отправляем email с токеном (если настроен SMTP)
    if (isEmailConfigured()) {
      try {
        const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`
        
        console.log('[forgot-password] Sending email to:', user.email)
        console.log('[forgot-password] Reset URL:', resetUrl)
        
        const emailResult = await sendEmail({
          to: user.email,
          subject: 'Восстановление пароля - Flame CRM',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                .button:hover { background-color: #2563eb; }
                .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
              </style>
            </head>
            <body>
              <div class="container">
                <h2>Восстановление пароля</h2>
                <p>Здравствуйте, ${user.name}!</p>
                <p>Вы запросили восстановление пароля для вашего аккаунта в Flame CRM.</p>
                <p>Для сброса пароля нажмите на кнопку ниже:</p>
                <a href="${resetUrl}" class="button">Восстановить пароль</a>
                <p>Или скопируйте и вставьте эту ссылку в браузер:</p>
                <p style="word-break: break-all; color: #666; font-size: 12px;">${resetUrl}</p>
                <p><strong>Важно:</strong> Ссылка действительна в течение 24 часов. Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо.</p>
                <div class="footer">
                  <p>С уважением,<br>Команда Flame CRM</p>
                  <p>Если у вас возникли вопросы, напишите нам на <a href="mailto:info@flamecrm.ru">info@flamecrm.ru</a></p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: `
Восстановление пароля

Здравствуйте, ${user.name}!

Вы запросили восстановление пароля для вашего аккаунта в Flame CRM.

Для сброса пароля перейдите по ссылке:
${resetUrl}

Ссылка действительна в течение 24 часов.

Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо.

С уважением,
Команда Flame CRM
          `.trim(),
        })

        console.log(`[forgot-password] Email sent to ${user.email}`)
      } catch (emailError: any) {
        console.error('[forgot-password] Error sending email:', emailError)
        // Не возвращаем ошибку, если email не отправился - токен все равно создан
        // Пользователь может использовать токен напрямую
      }
    } else {
      console.warn('[forgot-password] SMTP not configured, email not sent')
      // В режиме разработки можно вернуть токен напрямую
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json({
          message: 'SMTP не настроен. В режиме разработки токен:',
          token: resetToken,
          resetUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`,
        })
      }
    }

    return NextResponse.json({
      message: 'Если пользователь с таким email существует, на него будет отправлено письмо с инструкциями',
    })
  } catch (error: any) {
    console.error('[forgot-password]', error)
    return NextResponse.json(
      { error: 'Ошибка при обработке запроса' },
      { status: 500 }
    )
  }
}

