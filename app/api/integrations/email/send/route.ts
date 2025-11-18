import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'
import { isEmailConfigured, sendEmail } from '@/lib/email'

export async function POST(request: Request) {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 })
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({ error: 'SMTP не настроен. Укажите MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASSWORD, MAIL_FROM в .env' }, { status: 400 })
  }

  const body = await request.json()
  const contactId = Number(body.contactId)
  const subject = (body.subject || '').trim()
  const message = (body.message || '').trim()

  if (!contactId || !subject || !message) {
    return NextResponse.json({ error: 'Не заполнены обязательные поля' }, { status: 400 })
  }

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
  })

  if (!contact || !contact.email) {
    return NextResponse.json({ error: 'У контакта нет email' }, { status: 400 })
  }

  const log = await prisma.emailMessage.create({
    data: {
      subject,
      body: message,
      status: 'pending',
      toEmail: contact.email,
      userId: Number(currentUser.id),
      contactId: contact.id,
    },
  })

  try {
    const info = await sendEmail({
      to: contact.email,
      subject,
      text: message,
      html: message.replace(/\n/g, '<br/>'),
    })

    await prisma.emailMessage.update({
      where: { id: log.id },
      data: {
        status: 'sent',
        providerId: info.messageId ?? null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    await prisma.emailMessage.update({
      where: { id: log.id },
      data: {
        status: 'failed',
        error: error?.message || 'Не удалось отправить письмо',
      },
    })

    console.error('[email][send]', error)
    return NextResponse.json({ error: 'Не удалось отправить письмо' }, { status: 500 })
  }
}

