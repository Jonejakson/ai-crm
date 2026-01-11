import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/get-session"
import { fetchEmailsFromImap } from "@/lib/email/imap-client"
import { fetchEmailsFromGmail } from "@/lib/email/gmail-client"
import { fetchEmailsFromOutlook } from "@/lib/email/outlook-client"
import { processIncomingEmail } from "@/lib/email/processor"
import { decryptPassword } from "@/lib/encryption"

type RouteContext = { params: Promise<{ id: string }> }

// Синхронизация писем для конкретной интеграции
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id: rawId } = await context.params
    const id = Number(rawId)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const companyId = parseInt(user.companyId)
    const integration = await prisma.emailIntegration.findFirst({
      where: { id, companyId },
      include: {
        defaultAssignee: true,
        defaultSource: true,
        defaultPipeline: true,
      },
    })

    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 })
    }

    if (!integration.isActive || !integration.isIncomingEnabled) {
      return NextResponse.json({ error: "Integration is not active or incoming is disabled" }, { status: 400 })
    }

    // Получаем письма в зависимости от провайдера
    let emails: any[] = []
    const since = integration.lastSyncAt || undefined

    try {
      switch (integration.provider) {
        case 'GMAIL':
          if (!integration.accessToken || !integration.refreshToken) {
            throw new Error('Gmail integration requires OAuth tokens')
          }
          emails = await fetchEmailsFromGmail({
            accessToken: decryptPassword(integration.accessToken),
            refreshToken: decryptPassword(integration.refreshToken),
            email: integration.email,
          }, since)
          break

        case 'OUTLOOK':
          if (!integration.accessToken || !integration.refreshToken) {
            throw new Error('Outlook integration requires OAuth tokens')
          }
          emails = await fetchEmailsFromOutlook({
            accessToken: decryptPassword(integration.accessToken),
            refreshToken: decryptPassword(integration.refreshToken),
            email: integration.email,
          }, since)
          break

        case 'IMAP_SMTP':
        case 'YANDEX':
          if (!integration.imapHost || !integration.imapUsername || !integration.imapPassword) {
            throw new Error('IMAP configuration is incomplete')
          }
          emails = await fetchEmailsFromImap({
            host: integration.imapHost,
            port: integration.imapPort || 993,
            username: integration.imapUsername,
            password: decryptPassword(integration.imapPassword),
            useSSL: integration.useSSL,
          }, since)
          break

        default:
          throw new Error(`Unsupported provider: ${integration.provider}`)
      }

      // Обрабатываем каждое письмо
      let processedCount = 0
      let createdContacts = 0
      let createdDeals = 0

      for (const email of emails) {
        try {
          const result = await processIncomingEmail(email, integration, companyId)
          if (result.contactCreated) createdContacts++
          if (result.dealCreated) createdDeals++
          processedCount++

          // Сохраняем письмо в базу
          await prisma.emailMessage.create({
            data: {
              subject: email.subject,
              body: email.body,
              status: 'received',
              providerId: email.messageId,
              fromEmail: email.fromEmail,
              toEmail: integration.email,
              messageId: email.messageId,
              threadId: email.threadId,
              isIncoming: true,
              emailIntegrationId: integration.id,
              contactId: result.contactId,
              dealId: result.dealId,
              userId: result.userId,
            },
          })
        } catch (emailError) {
          console.error(`[email-sync][process-email]`, emailError)
          // Продолжаем обработку остальных писем
        }
      }

      // Обновляем время последней синхронизации
      await prisma.emailIntegration.update({
        where: { id },
        data: { lastSyncAt: new Date() },
      })

      return NextResponse.json({
        success: true,
        processed: processedCount,
        createdContacts,
        createdDeals,
      })
    } catch (syncError) {
      console.error('[email-sync][sync]', syncError)
      return NextResponse.json(
        { error: syncError instanceof Error ? syncError.message : 'Sync failed' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("[email-integrations][sync]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}


