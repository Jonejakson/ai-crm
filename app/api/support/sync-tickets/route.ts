import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'
import { fetchEmailsFromImap } from '@/lib/email/imap-client'
import { processTicketReplyEmail, shouldProcessAsTicketReply } from '@/lib/support/ticket-email-handler'
import type { ParsedEmail } from '@/lib/support/ticket-parser'
import { decryptPassword } from '@/lib/encryption'

/**
 * API для синхронизации ответов на тикеты с почты
 * Вызывается вручную или через cron
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Находим email интеграцию для info@flamecrm.ru
    const supportEmail = 'info@flamecrm.ru'
    const integration = await prisma.emailIntegration.findFirst({
      where: {
        email: supportEmail,
        isActive: true,
        isIncomingEnabled: true,
      },
    })

    if (!integration) {
      return NextResponse.json({
        success: false,
        error: 'Email integration for support not found. Please configure IMAP for info@flamecrm.ru',
      })
    }

    if (integration.provider !== 'IMAP_SMTP' && integration.provider !== 'YANDEX') {
      return NextResponse.json({
        success: false,
        error: 'Only IMAP/SMTP and Yandex integrations are supported for ticket sync',
      })
    }

    if (!integration.imapHost || !integration.imapUsername || !integration.imapPassword) {
      return NextResponse.json({
        success: false,
        error: 'IMAP configuration is incomplete',
      })
    }

    // Получаем письма
    const since = integration.lastSyncAt || undefined
    const emails = await fetchEmailsFromImap(
      {
        host: integration.imapHost,
        port: integration.imapPort || 993,
        username: integration.imapUsername,
        password: decryptPassword(integration.imapPassword),
        useSSL: integration.useSSL,
      },
      since
    )

    let processedTickets = 0
    let errors: string[] = []

    // Обрабатываем каждое письмо
    for (const email of emails) {
      try {
        const parsedEmail: ParsedEmail = {
          subject: email.subject,
          body: email.body,
          fromEmail: email.fromEmail,
          fromName: email.from,
          messageId: email.messageId,
          inReplyTo: email.threadId,
          headers: {
            'To': email.to.join(', ') || supportEmail,
            'From': email.fromEmail,
            ...email.headers,
          },
        }

        if (shouldProcessAsTicketReply(parsedEmail, supportEmail)) {
          const result = await processTicketReplyEmail(parsedEmail, supportEmail)
          if (result.processed) {
            processedTickets++
          } else if (result.error) {
            errors.push(`${email.subject}: ${result.error}`)
          }
        }
      } catch (emailError) {
        console.error('[sync-tickets][process-email]', emailError)
        errors.push(`${email.subject}: ${emailError instanceof Error ? emailError.message : 'Unknown error'}`)
      }
    }

    // Обновляем время последней синхронизации
    await prisma.emailIntegration.update({
      where: { id: integration.id },
      data: { lastSyncAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      processedTickets,
      totalEmails: emails.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('[sync-tickets]', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

