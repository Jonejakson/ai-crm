import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'
import { isEmailConfigured, sendEmail } from '@/lib/email'
import { SUPPORT_EMAIL } from '@/lib/support/config'

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
        companyId: Number(user.companyId),
        userId: Number(user.id),
      },
    })

    // Сообщение уже сохранено в поле message тикета

    // Отправляем email на info@flamecrm.ru
    // Используем SMTP_* переменные если есть, иначе MAIL_*
    const smtpHost = process.env.SMTP_HOST || process.env.MAIL_HOST
    const smtpPort = process.env.SMTP_PORT || process.env.MAIL_PORT
    const smtpUser = process.env.SMTP_USER || process.env.MAIL_USER
    const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.MAIL_PASSWORD
    const smtpFrom = process.env.SMTP_FROM || process.env.MAIL_FROM

    if (smtpHost && smtpPort && smtpUser && smtpPass && smtpFrom) {
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

        // Используем sendEmail с расширенными опциями через nodemailer
        const nodemailer = require('nodemailer')
        
        // Для Mail.ru нужны специальные настройки
        const isMailRu = smtpHost.includes('mail.ru')
        const port = Number(smtpPort)
        const secure = port === 465
        
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: port,
          secure: secure,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
          // Дополнительные настройки для Mail.ru
          ...(isMailRu && {
            tls: {
              rejectUnauthorized: false,
            },
          }),
        })
        
        // Для Mail.ru не проверяем подключение заранее, так как может быть ошибка с паролем приложения

        // Отправляем на info@flamecrm.ru
        await transporter.sendMail({
          from: smtpFrom,
          to: SUPPORT_EMAIL,
          subject: emailSubject,
          text: emailBody,
          html: emailBody.replace(/\n/g, '<br/>'),
          headers: {
            'X-Ticket-ID': ticketId,
            'Reply-To': SUPPORT_EMAIL,
          },
        })
        
        console.log(`[support][email] Email отправлен на ${SUPPORT_EMAIL} для тикета ${ticketId}`)
      } catch (emailError: any) {
        const errorMessage = emailError?.message || String(emailError)
        console.error('[support][email] Ошибка отправки email:', errorMessage)
        
        // Если ошибка связана с паролем приложения Mail.ru
        if (errorMessage.includes('parol prilozheniya') || errorMessage.includes('Application password')) {
          console.error('[support][email] ВАЖНО: Mail.ru требует пароль приложения!')
          console.error('[support][email] Инструкция: https://help.mail.ru/mail/security/protection/external')
          console.error('[support][email] Нужно создать пароль приложения в настройках почты Mail.ru')
        }
        
        // Не блокируем создание тикета из-за ошибки email
      }
    } else {
      console.warn('[support][email] SMTP не настроен, email не отправлен. Нужны: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM')
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

    return NextResponse.json({ 
      success: true, 
      ticket
    })
  } catch (error) {
    console.error('[support][POST]', error)
    return NextResponse.json({ error: 'Не удалось создать тикет' }, { status: 500 })
  }
}

// Получить тикеты пользователя (owner видит все тикеты)
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Owner видит все тикеты, остальные - только свои
    const isOwner = user.role === 'owner'
    const whereCondition = isOwner 
      ? {} // Owner видит все тикеты
      : { userId: Number(user.id) } // Остальные - только свои

    const tickets = await prisma.supportTicket.findMany({
      where: whereCondition,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            companyId: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Добавляем количество непрочитанных сообщений для каждого тикета
    const ticketsWithUnread = tickets.map(ticket => {
      const unreadCount = ticket.messages.filter(
        msg => msg.isFromAdmin && !msg.isRead
      ).length
      return {
        ...ticket,
        unreadMessagesCount: unreadCount,
      }
    })

    return NextResponse.json({ success: true, tickets: ticketsWithUnread })
  } catch (error) {
    console.error('[support][GET]', error)
    return NextResponse.json({ error: 'Не удалось получить тикеты' }, { status: 500 })
  }
}

