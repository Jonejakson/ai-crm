import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'
import { isOwner } from '@/lib/owner'
import { isEmailConfigured, sendEmail } from '@/lib/email'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (user.role !== 'owner' && !isOwner(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const ticketId = Number(id)
  if (!ticketId || Number.isNaN(ticketId)) {
    return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 })
  }

  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        company: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, ticket })
  } catch (error) {
    console.error('[support][tickets][GET id]', error)
    return NextResponse.json({ error: 'Не удалось загрузить тикет' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (user.role !== 'owner' && !isOwner(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const ticketId = Number(id)
  if (!ticketId || Number.isNaN(ticketId)) {
    return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const status = typeof body?.status === 'string' ? body.status : ''
    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 })
    }

    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status },
    })

    return NextResponse.json({ ok: true, ticket })
  } catch (error) {
    console.error('[support][tickets][PATCH]', error)
    return NextResponse.json({ error: 'Не удалось обновить тикет' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (user.role !== 'owner' && !isOwner(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const ticketId = Number(id)
  if (!ticketId || Number.isNaN(ticketId)) {
    return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    const status = typeof body?.status === 'string' ? body.status : undefined
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        subject: true,
        email: true,
        ticketId: true,
        status: true,
      },
    })
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const reply = await prisma.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        message,
        fromEmail: user.email || 'owner',
        fromName: user.name || null,
        isFromAdmin: true,
        isRead: true,
      },
    })

    if (status && status !== ticket.status) {
      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { status },
      })
    } else if (ticket.status === 'open') {
      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { status: 'in_progress' },
      })
    }

    if (isEmailConfigured()) {
      const subjectSuffix = ticket.ticketId ? ` [${ticket.ticketId}]` : ` #${ticket.id}`
      await sendEmail({
        to: ticket.email,
        subject: `Ответ по тикету${subjectSuffix}: ${ticket.subject}`,
        text: message,
      })
    }

    return NextResponse.json({ ok: true, reply })
  } catch (error) {
    console.error('[support][tickets][POST]', error)
    return NextResponse.json({ error: 'Не удалось отправить ответ' }, { status: 500 })
  }
}
