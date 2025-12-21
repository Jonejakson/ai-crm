import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'
import { isEmailConfigured, sendEmail } from '@/lib/email'

// Генерация уникального ID тикета
function generateTicketId(): string {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `TKT-${timestamp}-${random}`
}

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

    const ticketId = generateTicketId()
    const userEmail = (email || user.email || '').trim()

    const ticket = await prisma.supportTicket.create({
      data: {
        subject: subject.trim(),
        message: message.trim(),
        email: userEmail,
        ticketId: ticketId,
        companyId: Number(user.companyId),
        userId: Number(user.id),
      },
    })

    // Создаем первое сообщение от пользователя
    await prisma.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        message: message.trim(),
        fromEmail: userEmail,
        fromName: user.name || undefined,
        isFromAdmin: false,
      },
    })

    // Отправляем email админу
    const supportEmail = 'info@flamecrm.ru'
    if (isEmailConfigured()) {
      try {
        const emailSubject = `[${ticketId}] ${subject.trim()}`
        const emailBody = `
Новый тикет поддержки ${ticketId}

От: ${user.name || user.email}
Email: ${userEmail}
Компания ID: ${user.companyId}

Тема: ${subject.trim()}

Сообщение:
${message.trim()}

---
Ответьте на это письмо, чтобы добавить ответ в тикет.
Ticket ID: ${ticketId}
        `.trim()

        await sendEmail({
          to: supportEmail,
          subject: emailSubject,
          text: emailBody,
          html: emailBody.replace(/\n/g, '<br/>'),
        })
      } catch (emailError) {
        console.error('[support][email]', emailError)
        // Не блокируем создание тикета из-за ошибки email
      }
    }

    // Уведомление в Telegram (опционально)
    const botToken = process.env.TELEGRAM_SUPPORT_BOT_TOKEN
    const chatId = process.env.TELEGRAM_SUPPORT_CHAT_ID
    if (botToken && chatId) {
      const text =
        `🆕 Новый тикет поддержки ${ticketId}\n` +
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

// Получить тикеты пользователя
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tickets = await prisma.supportTicket.findMany({
      where: {
        userId: Number(user.id),
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ success: true, tickets })
  } catch (error) {
    console.error('[support][GET]', error)
    return NextResponse.json({ error: 'Не удалось получить тикеты' }, { status: 500 })
  }
}

