import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'

// Получить количество непрочитанных сообщений в тикетах поддержки
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const count = await prisma.supportTicketMessage.count({
      where: {
        ticket: { userId: Number(user.id) },
        isRead: false,
        isFromAdmin: true,
      },
    })
    return NextResponse.json({ success: true, count })
  } catch (error) {
    console.error('[support][unread-count]', error)
    return NextResponse.json({ error: 'Не удалось получить количество' }, { status: 500 })
  }
}

