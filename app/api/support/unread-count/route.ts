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
    // Считаем непрочитанные сообщения от админа в тикетах пользователя
    const unreadCount = await prisma.supportTicketMessage.count({
      where: {
        ticket: {
          userId: Number(user.id),
        },
        isFromAdmin: true,
        isRead: false,
      },
    })

    return NextResponse.json({ success: true, count: unreadCount })
  } catch (error) {
    console.error('[support][unread-count]', error)
    return NextResponse.json({ error: 'Не удалось получить количество' }, { status: 500 })
  }
}

