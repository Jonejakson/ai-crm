import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'

/** Список тикетов текущего пользователя (клиента) */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { userId: Number(user.id) },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, message: true, isFromAdmin: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ ok: true, tickets })
  } catch (error) {
    console.error('[support][my-tickets][GET]', error)
    return NextResponse.json({ error: 'Не удалось загрузить тикеты' }, { status: 500 })
  }
}
