import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'

/**
 * Временный endpoint для исправления проблемы с companyId
 * Создает компанию для пользователя, если её нет
 */
export async function POST() {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Получаем пользователя из базы данных
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: {
        company: true,
      },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 })
    }

    // Если у пользователя нет компании или она не существует
    if (!dbUser.companyId || !dbUser.company) {
      // Создаем компанию для пользователя
      const company = await prisma.company.create({
        data: {
          name: dbUser.role === 'owner' ? 'Система' : `Компания ${dbUser.name}`,
          isLegalEntity: false,
        },
      })

      // Обновляем пользователя
      const updatedUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: { companyId: company.id },
        include: {
          company: true,
        },
      })

      return NextResponse.json({
        message: 'Company created and user updated',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
          companyId: updatedUser.companyId,
          company: {
            id: updatedUser.company.id,
            name: updatedUser.company.name,
          },
        },
        note: 'Please logout and login again to update your session',
      })
    }

    return NextResponse.json({
      message: 'User already has a company',
      user: {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        companyId: dbUser.companyId,
        company: {
          id: dbUser.company.id,
          name: dbUser.company.name,
        },
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

