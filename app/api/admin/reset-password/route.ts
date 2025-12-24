import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'

/**
 * Сброс пароля пользователя (только для owner/admin)
 */
export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Только owner или admin могут сбрасывать пароли
    if (currentUser.role !== 'owner' && currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email и пароль обязательны' },
        { status: 400 }
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
    const hashedPassword = await bcrypt.hash(password, 10)

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
    console.error('[reset-password]', error)
    return NextResponse.json(
      { error: 'Ошибка при сбросе пароля' },
      { status: 500 }
    )
  }
}

