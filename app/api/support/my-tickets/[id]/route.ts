import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'

/** Клиент просматривает свой тикет с перепиской */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const ticketId = Number(id)
  if (!ticketId || Number.isNaN(ticketId)) {
    return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 })
  }

  try {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: ticketId, userId: Number(user.id) },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Тикет не найден' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, ticket })
  } catch (error) {
    console.error('[support][my-tickets][GET id]', error)
    return NextResponse.json({ error: 'Не удалось загрузить тикет' }, { status: 500 })
  }
}

/** Клиент добавляет ответ в свой тикет */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const ticketId = Number(id)
  if (!ticketId || Number.isNaN(ticketId)) {
    return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    if (!message || message.length < 1) {
      return NextResponse.json({ error: 'Введите сообщение' }, { status: 400 })
    }

    const ticket = await prisma.supportTicket.findFirst({
      where: { id: ticketId, userId: Number(user.id) },
      select: { id: true, status: true },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Тикет не найден' }, { status: 404 })
    }

    await prisma.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        message,
        fromEmail: user.email || '',
        fromName: user.name || null,
        isFromAdmin: false,
        isRead: false,
      },
    })

    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { status: 'open' },
      })
    }

    const updated = await prisma.supportTicket.findFirst({
      where: { id: ticketId, userId: Number(user.id) },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })

    return NextResponse.json({ ok: true, ticket: updated })
  } catch (error) {
    console.error('[support][my-tickets][POST]', error)
    return NextResponse.json({ error: 'Не удалось отправить ответ' }, { status: 500 })
  }
}
