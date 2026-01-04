import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Получаем пользователя из базы данных
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
      },
    })

    return NextResponse.json({
      session: {
        id: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
      database: dbUser,
      match: user.role === dbUser?.role,
      isAdmin: user.role === 'admin',
      isOwner: user.role === 'owner',
      canAccessCompany: user.role === 'admin' || user.role === 'owner',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

