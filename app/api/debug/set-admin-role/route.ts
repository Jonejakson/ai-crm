import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'

/**
 * Временный endpoint для установки роли admin
 * Работает только если в системе нет других админов или если пользователь уже админ
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Проверяем, есть ли другие админы в системе
    const adminCount = await prisma.user.count({
      where: {
        role: 'admin',
      },
    })

    // Если админов нет или пользователь уже админ - разрешаем
    const canUpdate = adminCount === 0 || user.role === 'admin'

    if (!canUpdate) {
      return NextResponse.json(
        { error: 'Forbidden: Only when no admins exist or you are already admin' },
        { status: 403 }
      )
    }

    // Обновляем роль текущего пользователя на admin
    const updatedUser = await prisma.user.update({
      where: { email: user.email },
      data: { role: 'admin' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    })

    return NextResponse.json({
      message: 'Role updated to admin',
      user: updatedUser,
      note: 'Please refresh the page and login again',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

