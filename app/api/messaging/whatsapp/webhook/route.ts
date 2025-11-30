import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { decrypt } from "@/lib/encryption"
import { parsePipelineStages } from "@/lib/pipelines"
import { processAutomations } from "@/lib/automations"

// Webhook для получения сообщений от WhatsApp Business API
// GET - для верификации webhook (WhatsApp требует это)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    // Находим все активные WhatsApp интеграции
    const integrations = await prisma.messagingIntegration.findMany({
      where: {
        platform: 'WHATSAPP',
        isActive: true,
        webhookSecret: { not: null },
      },
    })

    // Проверяем каждую интеграцию (webhookSecret зашифрован)
    for (const integration of integrations) {
      if (integration.webhookSecret) {
        const decryptedSecret = decrypt(integration.webhookSecret)
        if (mode === 'subscribe' && token === decryptedSecret) {
          return NextResponse.json(Number(challenge), { status: 200 })
        }
      }
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  } catch (error) {
    console.error("[whatsapp-webhook][GET]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// POST - для получения сообщений
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // WhatsApp Business API отправляет данные в формате:
    // { object: 'whatsapp_business_account', entry: [...] }
    if (body.object !== 'whatsapp_business_account' || !body.entry) {
      return NextResponse.json({ ok: true })
    }

    // Находим активную WhatsApp интеграцию
    const integration = await prisma.messagingIntegration.findFirst({
      where: {
        platform: 'WHATSAPP',
        isActive: true,
        botToken: { not: null },
      },
      include: {
        defaultAssignee: true,
        defaultSource: true,
        defaultPipeline: true,
      },
    })

    if (!integration || !integration.botToken) {
      console.warn("[whatsapp-webhook] No active integration found")
      return NextResponse.json({ ok: true })
    }

    // Обрабатываем каждую запись
    for (const entry of body.entry) {
      const changes = entry.changes || []
      
      for (const change of changes) {
        if (change.value?.messages) {
          // Обрабатываем входящие сообщения
          for (const message of change.value.messages) {
            await processWhatsAppMessage(message, integration)
          }
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[whatsapp-webhook][POST]", error)
    // Всегда возвращаем ok: true, чтобы WhatsApp не повторял запрос
    return NextResponse.json({ ok: true })
  }
}

// Обработать сообщение WhatsApp
async function processWhatsAppMessage(message: any, integration: any) {
  try {
    const phoneNumber = message.from // Номер отправителя (в формате 1234567890)
    const text = message.text?.body || message.type || ""
    const messageId = message.id
    const timestamp = message.timestamp

    // Форматируем номер телефона (убираем код страны, если есть)
    const formattedPhone = phoneNumber ? `+${phoneNumber}` : null

    // Находим или создаем контакт
    let contact = null
    let isNewContact = false

    if (formattedPhone) {
      const existing = await prisma.contact.findFirst({
        where: {
          phone: formattedPhone,
          user: {
            companyId: integration.companyId,
          },
        },
      })

      if (existing) {
        // Обновляем существующий контакт
        contact = await prisma.contact.update({
          where: { id: existing.id },
          data: {
            name: existing.name || `WhatsApp ${phoneNumber}`,
            phone: formattedPhone,
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
          console.error("[whatsapp-webhook] No user available in company")
          return
        }

        contact = await prisma.contact.create({
          data: {
            name: `WhatsApp ${phoneNumber}`,
            phone: formattedPhone,
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
          platform: 'WHATSAPP',
          externalId: messageId,
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
                title: `Заявка из WhatsApp: ${contact.name}`,
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
  } catch (error) {
    console.error("[whatsapp-webhook][processMessage]", error)
  }
}

