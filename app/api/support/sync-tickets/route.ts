import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'
import { fetchEmailsFromImap } from '@/lib/email/imap-client'
import { decryptPassword } from '@/lib/encryption'
import { getSupportEmailConfig, SUPPORT_EMAIL } from '@/lib/support/config'

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
    // Сначала пытаемся найти email интеграцию
    let integration = await prisma.emailIntegration.findFirst({
      where: {
        email: SUPPORT_EMAIL,
        isActive: true,
        isIncomingEnabled: true,
      },
    })

    let imapConfig: {
      host: string
      port: number
      username: string
      password: string
      useSSL: boolean
    } | null = null
    let lastSyncAt: Date | undefined = undefined

    // Если интеграция найдена - используем её
    if (integration && integration.imapHost && integration.imapUsername && integration.imapPassword) {
      imapConfig = {
        host: integration.imapHost,
        port: integration.imapPort || 993,
        username: integration.imapUsername,
        password: decryptPassword(integration.imapPassword),
        useSSL: integration.useSSL ?? true,
      }
      lastSyncAt = integration.lastSyncAt || undefined
    } else {
      // Иначе используем системные настройки из переменных окружения
      const supportConfig = getSupportEmailConfig()
      if (!supportConfig.configured) {
        return NextResponse.json({
          success: false,
          error: 'Support email not configured. Please set SUPPORT_IMAP_* environment variables or configure email integration for info@flamecrm.ru',
        })
      }

      imapConfig = {
        host: supportConfig.imapHost!,
        port: supportConfig.imapPort!,
        username: supportConfig.imapUsername!,
        password: supportConfig.imapPassword!,
        useSSL: supportConfig.useSSL!,
      }
    }

    // Получаем письма
    const emails = await fetchEmailsFromImap(imapConfig, lastSyncAt)

    // Обработка тикетов через email временно отключена (модель SupportTicketMessage не существует)

    // Обновляем время последней синхронизации
    if (integration) {
      await prisma.emailIntegration.update({
        where: { id: integration.id },
        data: { lastSyncAt: new Date() },
      })
    }
    // Если используется системная конфигурация, время синхронизации не сохраняется
    // (можно добавить в будущем отдельную таблицу для системных настроек)

    return NextResponse.json({
      success: true,
      processedTickets: 0,
      totalEmails: emails.length,
      message: 'Ticket processing via email is temporarily disabled',
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

