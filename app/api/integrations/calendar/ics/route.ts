import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'
import { createEvents } from 'ics'

function toIcsDate(date: Date) {
  return [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
  ] as [number, number, number, number, number]
}

export async function GET() {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 })
  }

  const events = await prisma.event.findMany({
    where: {
      userId: Number(currentUser.id),
    },
    orderBy: { startDate: 'asc' },
    take: 500,
  })

  if (events.length === 0) {
    return NextResponse.json({ error: 'Нет событий для экспорта' }, { status: 404 })
  }

  const mapped = events.map((event) => {
    const start = toIcsDate(new Date(event.startDate))
    const end = event.endDate ? toIcsDate(new Date(event.endDate)) : undefined
    return {
      title: event.title,
      description: event.description || undefined,
      location: event.location || undefined,
      start,
      end,
      status: 'CONFIRMED' as const,
      busyStatus: 'BUSY' as const,
      categories: [event.type],
    }
  })

  const { error, value } = createEvents(mapped)

  if (error || !value) {
    console.error('[calendar][ics]', error)
    return NextResponse.json({ error: 'Не удалось собрать календарь' }, { status: 500 })
  }

  return new Response(value, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="pulse-crm-events.ics"',
    },
  })
}

