import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/get-session"
import { encrypt } from "@/lib/encryption"
import { checkMessagingIntegrationsAccess } from "@/lib/subscription-limits"

// Получить WhatsApp интеграцию компании
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const companyId = parseInt(user.companyId)
    const integration = await prisma.messagingIntegration.findFirst({
      where: { 
        companyId,
        platform: 'WHATSAPP'
      },
      include: {
        defaultAssignee: { select: { id: true, name: true, email: true } },
        defaultSource: { select: { id: true, name: true } },
        defaultPipeline: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(integration || null)
  } catch (error) {
    console.error("[whatsapp][GET]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// Создать или обновить WhatsApp интеграцию
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const companyId = parseInt(user.companyId)
    
    // Проверка доступа к WhatsApp интеграции
    const messagingAccess = await checkMessagingIntegrationsAccess(companyId)
    if (!messagingAccess.allowed) {
      return NextResponse.json(
        { error: messagingAccess.message || "WhatsApp интеграция недоступна для вашего тарифа" },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Для WhatsApp Business API нужны:
    // - API Key (или Access Token)
    // - Phone Number ID
    // - Business Account ID (опционально)
    // - Webhook Verify Token (для верификации webhook)
    
    if (!body.apiKey || !body.apiKey.trim()) {
      return NextResponse.json({ error: "API Key is required" }, { status: 400 })
    }

    if (!body.phoneNumberId || !body.phoneNumberId.trim()) {
      return NextResponse.json({ error: "Phone Number ID is required" }, { status: 400 })
    }

    // Upsert интеграцию
    const integration = await prisma.messagingIntegration.upsert({
      where: {
        companyId_platform: {
          companyId,
          platform: 'WHATSAPP'
        }
      },
      update: {
        botToken: encrypt(body.apiKey.trim()), // Используем botToken для хранения API Key
        isActive: body.isActive !== false,
        autoCreateContact: body.autoCreateContact !== false,
        autoCreateDeal: body.autoCreateDeal === true,
        defaultSourceId: body.defaultSourceId ? Number(body.defaultSourceId) : null,
        defaultPipelineId: body.defaultPipelineId ? Number(body.defaultPipelineId) : null,
        defaultAssigneeId: body.defaultAssigneeId ? Number(body.defaultAssigneeId) : null,
        webhookSecret: body.webhookVerifyToken ? encrypt(body.webhookVerifyToken.trim()) : null,
        settings: {
          phoneNumberId: body.phoneNumberId.trim(),
          businessAccountId: body.businessAccountId?.trim() || null,
          apiVersion: body.apiVersion || 'v18.0',
        },
      },
      create: {
        platform: 'WHATSAPP',
        botToken: encrypt(body.apiKey.trim()),
        isActive: body.isActive !== false,
        autoCreateContact: body.autoCreateContact !== false,
        autoCreateDeal: body.autoCreateDeal === true,
        defaultSourceId: body.defaultSourceId ? Number(body.defaultSourceId) : null,
        defaultPipelineId: body.defaultPipelineId ? Number(body.defaultPipelineId) : null,
        defaultAssigneeId: body.defaultAssigneeId ? Number(body.defaultAssigneeId) : null,
        webhookSecret: body.webhookVerifyToken ? encrypt(body.webhookVerifyToken.trim()) : null,
        settings: {
          phoneNumberId: body.phoneNumberId.trim(),
          businessAccountId: body.businessAccountId?.trim() || null,
          apiVersion: body.apiVersion || 'v18.0',
        },
        companyId,
      },
      include: {
        defaultAssignee: { select: { id: true, name: true, email: true } },
        defaultSource: { select: { id: true, name: true } },
        defaultPipeline: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(integration)
  } catch (error) {
    console.error("[whatsapp][POST]", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

