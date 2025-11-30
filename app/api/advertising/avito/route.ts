import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/get-session"
import { encrypt } from "@/lib/encryption"

// Получить Авито интеграцию компании
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
        platform: 'AVITO'
      },
      include: {
        defaultAssignee: { select: { id: true, name: true, email: true } },
        defaultSource: { select: { id: true, name: true } },
        defaultPipeline: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(integration || null)
  } catch (error) {
    console.error("[avito][GET]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// Создать или обновить Авито интеграцию
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

    // Для Авито нужны:
    // - Client ID (apiToken)
    // - Client Secret (apiSecret)
    // - Webhook Secret (для верификации webhook)
    
    if (!body.clientId || !body.clientId.trim()) {
      return NextResponse.json({ error: "Client ID обязателен" }, { status: 400 })
    }

    if (!body.clientSecret || !body.clientSecret.trim()) {
      return NextResponse.json({ error: "Client Secret обязателен" }, { status: 400 })
    }

    // Upsert интеграцию
    const integration = await prisma.advertisingIntegration.upsert({
      where: {
        companyId_platform: {
          companyId,
          platform: 'AVITO'
        }
      },
      update: {
        name: body.name?.trim() || null,
        apiToken: encrypt(body.clientId.trim()),
        apiSecret: encrypt(body.clientSecret.trim()),
        accountId: body.userId?.trim() || null,
        webhookSecret: body.webhookSecret ? encrypt(body.webhookSecret.trim()) : null,
        isActive: body.isActive !== false,
        autoCreateContact: body.autoCreateContact !== false,
        autoCreateDeal: body.autoCreateDeal === true,
        defaultSourceId: body.defaultSourceId ? Number(body.defaultSourceId) : null,
        defaultPipelineId: body.defaultPipelineId ? Number(body.defaultPipelineId) : null,
        defaultAssigneeId: body.defaultAssigneeId ? Number(body.defaultAssigneeId) : null,
        settings: body.settings || null,
      },
      create: {
        platform: 'AVITO',
        name: body.name?.trim() || null,
        apiToken: encrypt(body.clientId.trim()),
        apiSecret: encrypt(body.clientSecret.trim()),
        accountId: body.userId?.trim() || null,
        webhookSecret: body.webhookSecret ? encrypt(body.webhookSecret.trim()) : null,
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
    console.error("[avito][POST]", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

