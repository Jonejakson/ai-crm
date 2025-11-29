import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/get-session"

// Получить Яндекс.Директ интеграцию компании
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
    const integration = await prisma.advertisingIntegration.findFirst({
      where: { 
        companyId,
        platform: 'YANDEX_DIRECT'
      },
      include: {
        defaultAssignee: { select: { id: true, name: true, email: true } },
        defaultSource: { select: { id: true, name: true } },
        defaultPipeline: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(integration || null)
  } catch (error) {
    console.error("[yandex-direct][GET]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// Создать или обновить Яндекс.Директ интеграцию
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const companyId = parseInt(user.companyId)

    // Для Яндекс.Директ нужны:
    // - OAuth токен (apiToken)
    // - Client ID (accountId)
    // - Webhook Secret (для верификации webhook)
    
    if (!body.apiToken || !body.apiToken.trim()) {
      return NextResponse.json({ error: "OAuth токен обязателен" }, { status: 400 })
    }

    // Upsert интеграцию
    const integration = await prisma.advertisingIntegration.upsert({
      where: {
        companyId_platform: {
          companyId,
          platform: 'YANDEX_DIRECT'
        }
      },
      update: {
        name: body.name?.trim() || null,
        apiToken: body.apiToken.trim(),
        accountId: body.accountId?.trim() || null,
        webhookSecret: body.webhookSecret?.trim() || null,
        isActive: body.isActive !== false,
        autoCreateContact: body.autoCreateContact !== false,
        autoCreateDeal: body.autoCreateDeal === true,
        defaultSourceId: body.defaultSourceId ? Number(body.defaultSourceId) : null,
        defaultPipelineId: body.defaultPipelineId ? Number(body.defaultPipelineId) : null,
        defaultAssigneeId: body.defaultAssigneeId ? Number(body.defaultAssigneeId) : null,
        settings: body.settings || null,
      },
      create: {
        platform: 'YANDEX_DIRECT',
        name: body.name?.trim() || null,
        apiToken: body.apiToken.trim(),
        accountId: body.accountId?.trim() || null,
        webhookSecret: body.webhookSecret?.trim() || null,
        isActive: body.isActive !== false,
        autoCreateContact: body.autoCreateContact !== false,
        autoCreateDeal: body.autoCreateDeal === true,
        defaultSourceId: body.defaultSourceId ? Number(body.defaultSourceId) : null,
        defaultPipelineId: body.defaultPipelineId ? Number(body.defaultPipelineId) : null,
        defaultAssigneeId: body.defaultAssigneeId ? Number(body.defaultAssigneeId) : null,
        settings: body.settings || null,
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
    console.error("[yandex-direct][POST]", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

