import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'
import { isEmailConfigured, sendEmail } from '@/lib/email'
import { SUPPORT_EMAIL } from '@/lib/support/config'

type RouteContext = {
  params: Promise<{ id: string }>
}

// Получить тикет по ID
export async function GET(request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const ticketId = parseInt(id)

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
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
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Тикет не найден' }, { status: 404 })
    }

    // Проверка доступа: owner видит все, пользователь - только свои
    if (user.role !== 'owner' && ticket.userId !== Number(user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ success: true, ticket })
  } catch (error) {
    console.error('[support][tickets][id][GET]', error)
    return NextResponse.json({ error: 'Не удалось получить тикет' }, { status: 500 })
  }
}

// Ответить на тикет
export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const ticketId = parseInt(id)
    const { message } = await request.json()

    if (!message || message.trim().length < 1) {
      return NextResponse.json({ error: 'Укажите сообщение' }, { status: 400 })
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Тикет не найден' }, { status: 404 })
    }

    // Проверка доступа
    if (user.role !== 'owner' && ticket.userId !== Number(user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const isAdmin = user.role === 'owner'

    // Создаем сообщение
    const ticketMessage = await prisma.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        message: message.trim(),
        fromEmail: user.email,
        fromName: user.name || undefined,
        isFromAdmin: isAdmin,
      },
    })

    // Обновляем статус тикета
    let newStatus = ticket.status
    if (isAdmin && ticket.status === 'open') {
      newStatus = 'in_progress'
    } else if (!isAdmin && ticket.status === 'in_progress') {
      newStatus = 'open' // Пользователь ответил, ждем ответа админа
    }

    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: newStatus,
        updatedAt: new Date(),
      },
    })

    // Отправляем email
    if (isEmailConfigured()) {
      try {
        const recipientEmail = isAdmin ? ticket.email : SUPPORT_EMAIL
        const emailSubject = `Re: [${ticket.ticketId}] ${ticket.subject}`
        const emailBody = `
${message.trim()}

---
Тикет: ${ticket.ticketId}
Ответьте на это письмо, чтобы добавить ответ в тикет.
        `.trim()

        await sendEmail({
          to: recipientEmail,
          subject: emailSubject,
          text: emailBody,
          html: emailBody.replace(/\n/g, '<br/>'),
        })
      } catch (emailError) {
        console.error('[support][tickets][id][email]', emailError)
        // Не блокируем ответ из-за ошибки email
      }
    }

    return NextResponse.json({ success: true, message: ticketMessage })
  } catch (error) {
    console.error('[support][tickets][id][POST]', error)
    return NextResponse.json({ error: 'Не удалось отправить ответ' }, { status: 500 })
  }
}

// Обновить статус тикета (только для owner)
export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const ticketId = parseInt(id)
    const { status } = await request.json()

    if (!status || !['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return NextResponse.json({ error: 'Неверный статус' }, { status: 400 })
    }

    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status },
    })

    return NextResponse.json({ success: true, ticket })
  } catch (error) {
    console.error('[support][tickets][id][PATCH]', error)
    return NextResponse.json({ error: 'Не удалось обновить тикет' }, { status: 500 })
  }
}

