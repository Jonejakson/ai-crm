import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/get-session"
import { sendEmailViaSmtp } from "@/lib/email/smtp-client"

type RouteContext = { params: Promise<{ id: string }> }

// Отправка письма через интеграцию
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: rawId } = await context.params
    const id = Number(rawId)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const body = await request.json()
    const { to, subject, body: emailBody, htmlBody, contactId, dealId } = body

    if (!to || !subject || !emailBody) {
      return NextResponse.json({ error: "to, subject, and body are required" }, { status: 400 })
    }

    const companyId = parseInt(user.companyId)
    const integration = await prisma.emailIntegration.findFirst({
      where: { id, companyId },
    })

    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 })
    }

    if (!integration.isActive || !integration.isOutgoingEnabled) {
      return NextResponse.json({ error: "Integration is not active or outgoing is disabled" }, { status: 400 })
    }

    // Отправляем письмо в зависимости от провайдера
    try {
      switch (integration.provider) {
        case 'GMAIL':
        case 'OUTLOOK':
          // TODO: Реализовать отправку через Gmail API / Outlook API
          return NextResponse.json({ error: "Gmail/Outlook sending via API not yet implemented" }, { status: 501 })

        case 'IMAP_SMTP':
        case 'YANDEX':
          if (!integration.smtpHost || !integration.smtpUsername || !integration.smtpPassword) {
            throw new Error('SMTP configuration is incomplete')
          }

          await sendEmailViaSmtp(
            {
              host: integration.smtpHost,
              port: integration.smtpPort || 465,
              username: integration.smtpUsername,
              password: await decryptPassword(integration.smtpPassword),
              useSSL: integration.useSSL,
              fromEmail: integration.email,
              fromName: integration.displayName || undefined,
            },
            {
              to,
              subject,
              body: emailBody,
              htmlBody,
            }
          )
          break

        default:
          throw new Error(`Unsupported provider: ${integration.provider}`)
      }

      // Сохраняем письмо в базу
      const emailMessage = await prisma.emailMessage.create({
        data: {
          subject,
          body: emailBody,
          status: 'sent',
          toEmail: Array.isArray(to) ? to.join(', ') : to,
          fromEmail: integration.email,
          isIncoming: false,
          emailIntegrationId: integration.id,
          contactId: contactId ? Number(contactId) : null,
          dealId: dealId ? Number(dealId) : null,
          userId: user.id,
        },
      })

      return NextResponse.json({
        success: true,
        messageId: emailMessage.id,
      })
    } catch (sendError) {
      console.error('[email-send][send]', sendError)
      
      // Сохраняем ошибку в базу
      await prisma.emailMessage.create({
        data: {
          subject,
          body: emailBody,
          status: 'failed',
          error: sendError instanceof Error ? sendError.message : 'Unknown error',
          toEmail: Array.isArray(to) ? to.join(', ') : to,
          fromEmail: integration.email,
          isIncoming: false,
          emailIntegrationId: integration.id,
          contactId: contactId ? Number(contactId) : null,
          dealId: dealId ? Number(dealId) : null,
          userId: user.id,
        },
      })

      return NextResponse.json(
        { error: sendError instanceof Error ? sendError.message : 'Send failed' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("[email-integrations][send]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// Простое расшифровывание паролей (в продакшене использовать более надежное решение)
async function decryptPassword(encrypted: string): Promise<string> {
  // TODO: Использовать crypto для расшифровки
  // Пока просто возвращаем как есть (в продакшене обязательно расшифровывать!)
  return encrypted
}

