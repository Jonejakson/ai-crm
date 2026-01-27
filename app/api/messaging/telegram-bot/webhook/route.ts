import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { decrypt } from "@/lib/encryption"
import { verifyWebhookSignature } from "@/lib/webhook-security"
import { parsePipelineStages } from "@/lib/pipelines"
import { processAutomations } from "@/lib/automations"

// Webhook для получения сообщений от Telegram
export async function POST(request: NextRequest) {
  try {
    // Получаем тело запроса как строку для проверки подписи
    const bodyText = await request.text()
    const update = JSON.parse(bodyText)

    // Telegram отправляет обновления в формате { message: {...}, update_id: ... }
    if (!update.message) {
      return NextResponse.json({ ok: true })
    }

    const message = update.message
    const chatId = message.chat.id
    const text = message.text || message.caption || ""
    const from = message.from

    if (!from) {
      return NextResponse.json({ ok: true })
    }

    // Важно (multi-tenant):
    // Telegram не присылает идентификатор бота в payload, поэтому однозначно определяем компанию
    // по заголовку x-telegram-bot-api-secret-token (secret_token задается при setWebhook).
    const incomingSecretToken = request.headers.get('x-telegram-bot-api-secret-token')

    const activeIntegrations = await prisma.messagingIntegration.findMany({
      where: {
        platform: 'TELEGRAM',
        isActive: true,
        botToken: { not: null },
      },
      include: {
        defaultAssignee: true,
        defaultSource: true,
        defaultPipeline: true,
      },
    })

    let integration = null as (typeof activeIntegrations)[number] | null
    if (incomingSecretToken) {
      for (const candidate of activeIntegrations) {
        if (!candidate.webhookSecret) continue
        const decryptedSecret = decrypt(candidate.webhookSecret)
        if (incomingSecretToken === decryptedSecret) {
          integration = candidate
          break
        }
      }
    } else if (activeIntegrations.length === 1) {
      // Фолбэк для старых настроек (без secret_token).
      // Если интеграций несколько — не угадываем, чтобы не смешивать компании.
      integration = activeIntegrations[0]
    }

    if (!integration || !integration.botToken) {
      console.warn("[telegram-webhook] No active integration found")
      return NextResponse.json({ ok: true })
    }

    // Если у интеграции есть webhookSecret, а токен не совпал — не обрабатываем
    if (integration.webhookSecret && incomingSecretToken) {
      const decryptedSecret = decrypt(integration.webhookSecret)
      if (incomingSecretToken !== decryptedSecret) {
        console.error("[telegram-webhook] Invalid secret token")
        return NextResponse.json({ error: "Invalid secret token" }, { status: 403 })
      }
    }

    // Извлекаем данные пользователя
    const firstName = from.first_name || ""
    const lastName = from.last_name || ""
    const username = from.username || null
    const baseName = `${firstName} ${lastName}`.trim()
    const name =
      baseName ||
      (username ? `Telegram @${username}` : "") ||
      `Telegram user ${from.id}`

    // Telegram НЕ отдает номер телефона по умолчанию.
    // Телефон возможен только если пользователь сам отправил контакт.
    const contactPhoneRaw: string | null = message.contact?.phone_number || null
    const normalizedPhone =
      contactPhoneRaw
        ? (contactPhoneRaw.startsWith("+") ? contactPhoneRaw : `+${contactPhoneRaw}`)
        : null

    const telegramChatId = chatId ? String(chatId) : null

    // Находим или создаем контакт
    let contact = null
    let isNewContact = false

    if (telegramChatId) {
      const existing = await prisma.contact.findFirst({
        where: {
          telegramChatId,
          user: { companyId: integration.companyId },
        },
      })

      if (existing) {
        // Обновляем существующий контакт
        contact = await prisma.contact.update({
          where: { id: existing.id },
          data: {
            name: name || existing.name,
            phone: normalizedPhone || existing.phone,
            telegramChatId,
            userId: existing.userId || integration.defaultAssigneeId || null,
          },
        })
      } else if (integration.autoCreateContact) {
        // Создаем новый контакт
        let assignedUserId = integration.defaultAssigneeId
        if (!assignedUserId) {
          const fallbackUser = await prisma.user.findFirst({
            where: { companyId: integration.companyId },
            select: { id: true },
            orderBy: { createdAt: "asc" },
          })
          assignedUserId = fallbackUser?.id || null
        }

        if (!assignedUserId) {
          console.error("[telegram-webhook] No user available in company")
          return NextResponse.json({ ok: true })
        }

        contact = await prisma.contact.create({
          data: {
            name,
            phone: normalizedPhone,
            telegramChatId,
            userId: assignedUserId,
          },
        })
        isNewContact = true
      }
    }

    // Сохраняем сообщение в диалог
    if (contact) {
      await prisma.dialog.create({
        data: {
          message: text,
          sender: "client",
          contactId: contact.id,
          platform: 'TELEGRAM',
          externalId: String(message.message_id),
        },
      })

      // Создаем сделку, если нужно
      if (integration.autoCreateDeal && integration.defaultPipelineId && isNewContact) {
        const pipeline = await prisma.pipeline.findFirst({
          where: {
            id: integration.defaultPipelineId,
            companyId: integration.companyId,
          },
          select: { stages: true },
        })

        if (pipeline) {
          const stages = parsePipelineStages(pipeline.stages)
          const initialStage = stages[0]?.name || "Новый лид"

          let userId: number | null = contact.userId || integration.defaultAssigneeId || null
          if (!userId) {
            const fallbackUser = await prisma.user.findFirst({
              where: { companyId: integration.companyId },
              select: { id: true },
              orderBy: { createdAt: "asc" },
            })
            userId = fallbackUser?.id || null
          }

          if (userId && typeof userId === 'number') {
            const deal = await prisma.deal.create({
              data: {
                title: `Заявка из Telegram: ${name}`,
                amount: 0,
                currency: "RUB",
                stage: initialStage,
                contactId: contact.id,
                userId: userId,
                pipelineId: integration.defaultPipelineId,
                sourceId: integration.defaultSourceId,
              },
            })

            // Запускаем автоматизации
            await processAutomations("DEAL_CREATED", {
              dealId: deal.id,
              contactId: contact.id,
              userId: userId,
              companyId: integration.companyId,
            })
          }
        }
      }

      // Запускаем автоматизации для нового контакта
      if (isNewContact) {
        await processAutomations("CONTACT_CREATED", {
          contactId: contact.id,
          userId: contact.userId || undefined,
          companyId: integration.companyId,
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[telegram-webhook][POST]", error)
    // Всегда возвращаем ok: true, чтобы Telegram не повторял запрос
    return NextResponse.json({ ok: true })
  }
}

// GET для верификации webhook (Telegram может проверять endpoint)
export async function GET() {
  return NextResponse.json({ status: "ok" })
}

