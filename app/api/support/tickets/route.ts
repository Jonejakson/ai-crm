import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'

// Получить все тикеты (для owner/admin)
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Только owner может видеть все тикеты
  if (user.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // open, in_progress, resolved, closed
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}
    if (status) {
      where.status = status
    }

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          messages: {
            orderBy: {
              createdAt: 'asc',
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.supportTicket.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      tickets,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('[support][tickets][GET]', error)
    return NextResponse.json({ error: 'Не удалось получить тикеты' }, { status: 500 })
  }
}



