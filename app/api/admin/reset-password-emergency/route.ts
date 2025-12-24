import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

/**
 * ЭКСТРЕННЫЙ сброс пароля БЕЗ авторизации
 * ВНИМАНИЕ: Используйте только в экстренных случаях! Удалите после использования!
 */
export async function POST(request: Request) {
  try {
    // Простая защита через секретный ключ из переменных окружения
    const emergencyKey = process.env.EMERGENCY_PASSWORD_RESET_KEY || 'emergency-reset-2024'
    
    const body = await request.json()
    const { email, newPassword, key } = body

    if (!email || !newPassword) {
      return NextResponse.json(
        { error: 'Email и пароль обязательны' },
        { status: 400 }
      )
    }

    // Проверяем ключ
    if (key !== emergencyKey) {
      return NextResponse.json(
        { error: 'Неверный ключ доступа' },
        { status: 403 }
      )
    }

    // Проверяем, что пользователь существует
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 }
      )
    }

    // Хешируем новый пароль
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Обновляем пароль
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    })

    return NextResponse.json({
      message: 'Пароль успешно обновлен',
      email: user.email,
    })
  } catch (error: any) {
    console.error('[emergency-reset-password]', error)
    return NextResponse.json(
      { error: 'Ошибка при сбросе пароля', details: error.message },
      { status: 500 }
    )
  }
}

