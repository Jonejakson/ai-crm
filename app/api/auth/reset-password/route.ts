import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'

/**
 * Сброс пароля по токену
 * POST /api/auth/reset-password
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { token, password } = body

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Токен и новый пароль обязательны' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Пароль должен быть не менее 6 символов' },
        { status: 400 }
      )
    }

    // Находим пользователя по токену
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date(), // Токен еще не истек
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Неверный или истекший токен восстановления' },
        { status: 400 }
      )
    }

    // Хешируем новый пароль
    const hashedPassword = await bcrypt.hash(password, 10)

    // Обновляем пароль и очищаем токен
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    })

    console.log(`[reset-password] Password reset successful for ${user.email}`)

    return NextResponse.json({
      message: 'Пароль успешно изменен',
    })
  } catch (error: any) {
    console.error('[reset-password]', error)
    return NextResponse.json(
      { error: 'Ошибка при сбросе пароля' },
      { status: 500 }
    )
  }
}

