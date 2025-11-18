import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'

export async function GET(request: Request) {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const contactId = Number(searchParams.get('contactId'))

  if (!contactId) {
    return NextResponse.json({ error: 'Не указан контакт' }, { status: 400 })
  }

  const logs = await prisma.emailMessage.findMany({
    where: { contactId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({ logs })
}

