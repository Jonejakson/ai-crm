import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { subject, message, email } = await request.json()
    if (!subject || subject.trim().length < 3) {
      return NextResponse.json({ error: 'Укажите тему (мин 3 символа)' }, { status: 400 })
    }
    if (!message || message.trim().length < 10) {
      return NextResponse.json({ error: 'Опишите вопрос (мин 10 символов)' }, { status: 400 })
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        subject: subject.trim(),
        message: message.trim(),
        email: (email || user.email || '').trim(),
        companyId: Number(user.companyId),
        userId: user.id,
      },
    })

    // Уведомление в Telegram (опционально)
    const botToken = process.env.TELEGRAM_SUPPORT_BOT_TOKEN
    const chatId = process.env.TELEGRAM_SUPPORT_CHAT_ID
    if (botToken && chatId) {
      const text =
        `🆕 Новый тикет поддержки\n` +
        `Компания: ${user.companyId}\n` +
        `Пользователь: ${user.name || user.email}\n` +
        `Email: ${ticket.email}\n` +
        `Тема: ${ticket.subject}\n` +
        `Сообщение:\n${ticket.message}`

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      }).catch(() => {
        // не блокируем ответ из-за Telegram
      })
    }

    return NextResponse.json({ success: true, ticket })
  } catch (error) {
    console.error('[support][POST]', error)
    return NextResponse.json({ error: 'Не удалось создать тикет' }, { status: 500 })
  }
}

