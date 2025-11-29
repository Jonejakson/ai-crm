import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { parsePipelineStages } from "@/lib/pipelines"
import { processAutomations } from "@/lib/automations"

type RouteContext = { params: Promise<{ token: string }> }

// Принять входящий webhook
export async function POST(request: NextRequest, context: RouteContext) {
  let webhook = null
  let payload: any = null
  let status = "success"
  let errorMessage: string | null = null
  let contactId: number | null = null
  let dealId: number | null = null

  try {
    const { token } = await context.params

    // Находим webhook по токену
    webhook = await prisma.webhookIntegration.findUnique({
      where: { token },
      include: {
        defaultAssignee: true,
        defaultSource: true,
        defaultPipeline: true,
      },
    })

    if (!webhook || !webhook.isActive) {
      return NextResponse.json(
        { error: "Webhook not found or inactive" },
        { status: 404 }
      )
    }

    // Получаем данные из запроса
    const contentType = request.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      payload = await request.json()
    } else {
      const formData = await request.formData()
      payload = Object.fromEntries(formData.entries())
    }

    // Применяем маппинг полей, если он настроен
    const mappedData = applyFieldMapping(payload, webhook.fieldMapping)

    // Обрабатываем данные
    const result = await processWebhookData(mappedData, webhook)

    contactId = result.contactId || null
    dealId = result.dealId || null

    // Сохраняем лог
    await prisma.webhookLog.create({
      data: {
        webhookId: webhook.id,
        payload: payload,
        response: { success: true, contactId, dealId },
        status: "success",
        ipAddress: getIpAddress(request),
        userAgent: request.headers.get("user-agent") || undefined,
        contactId,
        dealId,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Webhook processed successfully",
      contactId,
      dealId,
    })
  } catch (error) {
    console.error("[webhooks][incoming]", error)
    status = "error"
    errorMessage = error instanceof Error ? error.message : "Unknown error"

    // Сохраняем лог с ошибкой
    if (webhook) {
      try {
        await prisma.webhookLog.create({
          data: {
            webhookId: webhook.id,
            payload: payload || {},
            response: { error: errorMessage },
            status: "error",
            errorMessage,
            ipAddress: getIpAddress(request),
            userAgent: request.headers.get("user-agent") || undefined,
            contactId,
            dealId,
          },
        })
      } catch (logError) {
        console.error("[webhooks][incoming][log]", logError)
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

// Применить маппинг полей
function applyFieldMapping(data: any, mapping: any): any {
  if (!mapping || typeof mapping !== "object") {
    return data
  }

  const result: any = {}
  for (const [crmField, externalField] of Object.entries(mapping)) {
    if (externalField === null || externalField === undefined) {
      continue
    }
    if (typeof externalField === "string" && data[externalField] !== undefined) {
      result[crmField] = data[externalField]
    } else if (typeof externalField === "object" && externalField !== null && "path" in externalField && typeof externalField.path === "string") {
      // Поддержка вложенных путей: { "name": { "path": "user.full_name" } }
      const value = getNestedValue(data, externalField.path)
      if (value !== undefined) {
        result[crmField] = value
      }
    }
  }

  // Добавляем исходные данные, которые не были замаплены
  for (const [key, value] of Object.entries(data)) {
    if (!result[key] && !Object.values(mapping).includes(key)) {
      result[key] = value
    }
  }

  return result
}

// Получить вложенное значение по пути
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj)
}

// Обработать данные webhook'а
async function processWebhookData(
  data: any,
  webhook: any
): Promise<{ contactId?: number; dealId?: number }> {
  const result: { contactId?: number; dealId?: number } = {}

  // Извлекаем данные контакта
  const email = data.email?.trim() || data.email_address?.trim() || null
  const phone = data.phone?.trim() || data.phone_number?.trim() || data.tel?.trim() || null
  const name = data.name?.trim() || data.full_name?.trim() || data.fullName?.trim() || "Новый клиент"
  const companyName = data.company?.trim() || data.company_name?.trim() || data.organization?.trim() || null

  // Находим или создаем контакт
  let contact = null
  let isNewContact = false

  if (email || phone) {
    const whereConditions = []
    if (email) whereConditions.push({ email })
    if (phone) whereConditions.push({ phone })

    const existing = await prisma.contact.findFirst({
      where: {
        OR: whereConditions,
        user: {
          companyId: webhook.companyId,
        },
      },
    })

    if (existing) {
      // Обновляем существующий контакт
      contact = await prisma.contact.update({
        where: { id: existing.id },
        data: {
          name: name || existing.name,
          email: email || existing.email,
          phone: phone || existing.phone,
          company: companyName || existing.company,
          userId: existing.userId || webhook.defaultAssigneeId || null,
        },
      })
    } else if (webhook.autoCreateContact) {
      // Создаем новый контакт
      let assignedUserId = webhook.defaultAssigneeId
      if (!assignedUserId) {
        const fallbackUser = await prisma.user.findFirst({
          where: { companyId: webhook.companyId },
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
          email,
          phone,
          company: companyName,
          userId: assignedUserId,
        },
      })
      isNewContact = true
    }
  }

  if (contact) {
    result.contactId = contact.id

    // Создаем сделку, если нужно
    if (webhook.autoCreateDeal && webhook.defaultPipelineId) {
      const pipeline = await prisma.pipeline.findFirst({
        where: {
          id: webhook.defaultPipelineId,
          companyId: webhook.companyId,
        },
        select: { stages: true },
      })

      if (pipeline) {
        const stages = parsePipelineStages(pipeline.stages)
        const initialStage = stages[0]?.name || "Новый лид"

        // Определяем название сделки
        const dealTitle = data.deal_title?.trim() || 
                         data.title?.trim() || 
                         data.subject?.trim() || 
                         `Заявка от ${name}`

        // Определяем сумму, если есть
        const amount = data.amount || data.price || data.value || 0

        // Убеждаемся, что userId - это number, не null
        let userId: number | null = contact.userId || webhook.defaultAssigneeId || null
        if (!userId) {
          const fallbackUser = await prisma.user.findFirst({
            where: { companyId: webhook.companyId },
            select: { id: true },
            orderBy: { createdAt: "asc" },
          })
          userId = fallbackUser?.id || null
        }

        if (!userId || typeof userId !== 'number') {
          throw new Error("Cannot create deal: no user available in company")
        }

        // После проверки TypeScript знает, что userId - это number

        const deal = await prisma.deal.create({
          data: {
            title: dealTitle,
            amount: typeof amount === "number" ? amount : parseFloat(String(amount)) || 0,
            currency: data.currency || "RUB",
            stage: initialStage,
            contactId: contact.id,
            userId: userId,
            pipelineId: webhook.defaultPipelineId,
            sourceId: webhook.defaultSourceId,
          },
        })

        result.dealId = deal.id

        // Запускаем автоматизации
        await processAutomations("DEAL_CREATED", {
          dealId: deal.id,
          contactId: contact.id,
          userId: contact.userId || undefined,
          companyId: webhook.companyId,
        })
      }
    }

    // Запускаем автоматизации для нового контакта
    if (isNewContact) {
      await processAutomations("CONTACT_CREATED", {
        contactId: contact.id,
        userId: contact.userId || undefined,
        companyId: webhook.companyId,
      })
    }
  }

  return result
}

function getIpAddress(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0]?.trim()
  }
  return request.headers.get("x-real-ip") || undefined
}

