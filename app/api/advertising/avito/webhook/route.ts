import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { verifyAvitoWebhookSignature } from "@/lib/webhook-security"
import { processAvitoApplication } from "@/lib/advertising/avito"

// Webhook для получения заявок из Авито
export async function POST(request: NextRequest) {
  let integration = null
  let payload: any = null
  let status = "success"
  let errorMessage: string | null = null
  let contactId: number | null = null
  let dealId: number | null = null

  try {
    // Получаем тело запроса как строку для проверки подписи
    const bodyText = await request.text()
    payload = JSON.parse(bodyText)

    // Авито отправляет заявки через Webhook API
    // Формат: { value: { id, phone, name, ... } }
    
    // Находим активную Авито интеграцию
    integration = await prisma.advertisingIntegration.findFirst({
      where: {
        platform: 'AVITO',
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
      console.warn("[avito-webhook] No active integration found")
      return NextResponse.json({ ok: true })
    }

    // Проверяем webhook secret, если он настроен
    if (integration.webhookSecret) {
      const signature = request.headers.get('x-avito-signature')
      const isValid = await verifyAvitoWebhookSignature(
        bodyText,
        signature,
        integration.webhookSecret
      )
      
      if (!isValid) {
        console.error("[avito-webhook] Invalid signature")
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
      }
    }

    // Обрабатываем заявку
    const application = payload.value || payload
    
    try {
      const result = await processAvitoApplication(application, integration)
      if (result.contactId) contactId = result.contactId
      if (result.dealId) dealId = result.dealId

      // Сохраняем лог
      await prisma.advertisingLog.create({
        data: {
          advertisingId: integration.id,
          payload: application,
          response: { success: true, contactId: result.contactId, dealId: result.dealId },
          status: "success",
          contactId: result.contactId || null,
          dealId: result.dealId || null,
          leadId: application.id || application.applicationId || null,
          campaignId: application.itemId || application.adId || null,
        },
      })
    } catch (appError) {
      console.error("[avito-webhook][processApplication]", appError)
      status = "error"
      errorMessage = appError instanceof Error ? appError.message : "Unknown error"

      await prisma.advertisingLog.create({
        data: {
          advertisingId: integration.id,
          payload: application,
          response: { error: errorMessage },
          status: "error",
          errorMessage,
          leadId: application.id || application.applicationId || null,
          campaignId: application.itemId || application.adId || null,
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[avito-webhook][POST]", error)
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
        console.error("[avito-webhook][log]", logError)
      }
    }

    return NextResponse.json({ ok: true }) // Всегда возвращаем ok
  }
}

