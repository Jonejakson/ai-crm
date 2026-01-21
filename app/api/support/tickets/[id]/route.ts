import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'
import { isOwner } from '@/lib/owner'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (user.role !== 'owner' && !isOwner(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ticketId = Number(params.id)
  if (!ticketId || Number.isNaN(ticketId)) {
    return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 })
  }

  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        company: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
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
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (user.role !== 'owner' && !isOwner(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ticketId = Number(params.id)
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
