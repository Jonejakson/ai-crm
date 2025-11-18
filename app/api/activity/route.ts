import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'

export async function GET(request: Request) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = {
      companyId: Number(currentUser.companyId),
    }

    if (entityType) {
      where.entityType = entityType
    }

    if (entityId) {
      where.entityId = Number(entityId)
    }

    const logs = await prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('[activity][GET]', error)
    return NextResponse.json({ error: 'Ошибка загрузки активности' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { entityType, entityId, action, description, metadata } = body

    if (!entityType || !entityId || !action) {
      return NextResponse.json({ error: 'Необходимы: entityType, entityId, action' }, { status: 400 })
    }

    const log = await prisma.activityLog.create({
      data: {
        entityType,
        entityId: Number(entityId),
        action,
        description: description || null,
        metadata: metadata || null,
        userId: Number(currentUser.id) || null,
        companyId: Number(currentUser.companyId),
      },
    })

    return NextResponse.json({ log })
  } catch (error) {
    console.error('[activity][POST]', error)
    return NextResponse.json({ error: 'Ошибка создания записи активности' }, { status: 500 })
  }
}

