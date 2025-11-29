import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { parsePipelineStages } from "@/lib/pipelines"
import { processAutomations } from "@/lib/automations"
import crypto from "crypto"

// Webhook для получения лидов из Яндекс.Директ
export async function POST(request: NextRequest) {
  let integration = null
  let payload: any = null
  let status = "success"
  let errorMessage: string | null = null
  let contactId: number | null = null
  let dealId: number | null = null

  try {
    payload = await request.json()

    // Яндекс.Директ отправляет лиды через Call Tracking API
    // Формат: { leads: [{ id, phone, name, ... }] }
    
    // Находим активную Яндекс.Директ интеграцию
    integration = await prisma.advertisingIntegration.findFirst({
      where: {
        platform: 'YANDEX_DIRECT',
        isActive: true,
        apiToken: { not: null },
      },
      include: {
        defaultAssignee: true,
        defaultSource: true,
        defaultPipeline: true,
      },
    })

    if (!integration) {
      console.warn("[yandex-direct-webhook] No active integration found")
      return NextResponse.json({ ok: true })
    }

    // Проверяем webhook secret, если он настроен
    if (integration.webhookSecret) {
      const signature = request.headers.get('x-yandex-signature')
      if (signature) {
        // Проверка подписи (упрощенная версия)
        const expectedSignature = crypto
          .createHmac('sha256', integration.webhookSecret)
          .update(JSON.stringify(payload))
          .digest('hex')
        
        if (signature !== expectedSignature) {
          return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
        }
      }
    }

    // Обрабатываем лиды
    const leads = payload.leads || payload.lead ? [payload.lead || payload.leads[0]] : []
    
    for (const lead of leads) {
      try {
        const result = await processYandexDirectLead(lead, integration)
        if (result.contactId) contactId = result.contactId
        if (result.dealId) dealId = result.dealId

        // Сохраняем лог
        await prisma.advertisingLog.create({
          data: {
            advertisingId: integration.id,
            payload: lead,
            response: { success: true, contactId: result.contactId, dealId: result.dealId },
            status: "success",
            contactId: result.contactId || null,
            dealId: result.dealId || null,
            leadId: lead.id || lead.leadId || null,
            campaignId: lead.campaignId || lead.campaign_id || null,
          },
        })
      } catch (leadError) {
        console.error("[yandex-direct-webhook][processLead]", leadError)
        status = "error"
        errorMessage = leadError instanceof Error ? leadError.message : "Unknown error"

        await prisma.advertisingLog.create({
          data: {
            advertisingId: integration.id,
            payload: lead,
            response: { error: errorMessage },
            status: "error",
            errorMessage,
            leadId: lead.id || lead.leadId || null,
            campaignId: lead.campaignId || lead.campaign_id || null,
          },
        })
      }
    }

    return NextResponse.json({ ok: true, processed: leads.length })
  } catch (error) {
    console.error("[yandex-direct-webhook][POST]", error)
    status = "error"
    errorMessage = error instanceof Error ? error.message : "Unknown error"

    if (integration) {
      try {
        await prisma.advertisingLog.create({
          data: {
            advertisingId: integration.id,
            payload: payload || {},
            response: { error: errorMessage },
            status: "error",
            errorMessage,
            contactId,
            dealId,
          },
        })
      } catch (logError) {
        console.error("[yandex-direct-webhook][log]", logError)
      }
    }

    return NextResponse.json({ ok: true }) // Всегда возвращаем ok, чтобы Яндекс не повторял запрос
  }
}

// Обработать лид из Яндекс.Директ
async function processYandexDirectLead(
  lead: any,
  integration: any
): Promise<{ contactId?: number; dealId?: number }> {
  const result: { contactId?: number; dealId?: number } = {}

  // Извлекаем данные лида
  const phone = lead.phone || lead.phoneNumber || lead.tel || null
  const name = lead.name || lead.fullName || lead.clientName || `Лид из Яндекс.Директ`
  const email = lead.email || lead.emailAddress || null
  const comment = lead.comment || lead.message || lead.text || ""
  const campaignId = lead.campaignId || lead.campaign_id || null
  const leadId = lead.id || lead.leadId || null

  // Находим или создаем контакт
  let contact = null
  let isNewContact = false

  if (phone || email) {
    const whereConditions: any[] = []
    if (phone) whereConditions.push({ phone })
    if (email) whereConditions.push({ email })

    const existing = await prisma.contact.findFirst({
      where: {
        OR: whereConditions,
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
          name: name || existing.name,
          phone: phone || existing.phone,
          email: email || existing.email,
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
        throw new Error("Cannot create contact: no user available in company")
      }

      contact = await prisma.contact.create({
        data: {
          name,
          phone,
          email,
          userId: assignedUserId,
        },
      })
      isNewContact = true
    }
  }

  if (contact) {
    result.contactId = contact.id

    // Создаем сделку, если нужно
    if (integration.autoCreateDeal && integration.defaultPipelineId) {
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

        const dealTitle = comment 
          ? `Лид из Яндекс.Директ: ${comment.substring(0, 50)}`
          : `Лид из Яндекс.Директ: ${name}`

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
              title: dealTitle,
              amount: 0,
              currency: "RUB",
              stage: initialStage,
              contactId: contact.id,
              userId: userId,
              pipelineId: integration.defaultPipelineId,
              sourceId: integration.defaultSourceId,
            },
          })

          result.dealId = deal.id

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

  return result
}

