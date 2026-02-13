import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/get-session"
import { encrypt, decrypt } from "@/lib/encryption"
import { checkMessagingIntegrationsAccess } from "@/lib/subscription-limits"

// Получить все Telegram Bot интеграции компании
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
    const integrations = await prisma.messagingIntegration.findMany({
      where: { 
        companyId,
        platform: 'TELEGRAM'
      },
      include: {
        defaultAssignee: { select: { id: true, name: true, email: true } },
        defaultSource: { select: { id: true, name: true } },
        defaultPipeline: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(integrations)
  } catch (error) {
    console.error("[telegram-bot][GET]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// Создать или обновить Telegram Bot интеграцию
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
    
    // Проверка доступа к Telegram интеграции
    const messagingAccess = await checkMessagingIntegrationsAccess(companyId)
    if (!messagingAccess.allowed) {
      return NextResponse.json(
        { error: messagingAccess.message || "Telegram интеграция недоступна для вашего тарифа" },
        { status: 403 }
      )
    }

    const body = await request.json()

    const existing = await prisma.messagingIntegration.findUnique({
      where: {
        companyId_platform: { companyId, platform: 'TELEGRAM' },
      },
    })

    const isUpdateOnly = existing && (!body.botToken || !String(body.botToken).trim())
    let botTokenToUse: string

    if (isUpdateOnly) {
      if (!existing.botToken) {
        return NextResponse.json({ error: "Интеграция без токена. Укажите токен бота." }, { status: 400 })
      }
      botTokenToUse = decrypt(existing.botToken)
    } else {
      if (!body.botToken || !body.botToken.trim()) {
        return NextResponse.json({ error: "Bot token is required" }, { status: 400 })
      }
      botTokenToUse = body.botToken.trim()
      if (!/^\d+:[A-Za-z0-9_-]+$/.test(botTokenToUse)) {
        return NextResponse.json({ error: "Invalid bot token format" }, { status: 400 })
      }
      try {
        const botInfoResponse = await fetch(`https://api.telegram.org/bot${botTokenToUse}/getMe`)
        if (!botInfoResponse.ok) {
          return NextResponse.json({ error: "Invalid bot token" }, { status: 400 })
        }
        const botInfo = await botInfoResponse.json()
        if (!botInfo.ok) {
          return NextResponse.json({ error: "Invalid bot token" }, { status: 400 })
        }
      } catch (tokenError) {
        return NextResponse.json({ error: "Failed to validate bot token" }, { status: 400 })
      }
    }

    const defaultAssigneeId = body.defaultAssigneeId != null && body.defaultAssigneeId !== ''
      ? Number(body.defaultAssigneeId)
      : (existing?.defaultAssigneeId ?? null)
    if (defaultAssigneeId == null || Number.isNaN(defaultAssigneeId)) {
      return NextResponse.json({ error: "Выберите ответственного" }, { status: 400 })
    }

    // Upsert интеграцию
    const integration = await prisma.messagingIntegration.upsert({
      where: {
        companyId_platform: {
          companyId,
          platform: 'TELEGRAM'
        }
      },
      update: {
        botToken: encrypt(botTokenToUse),
        isActive: body.isActive !== false,
        autoCreateContact: body.autoCreateContact !== false,
        autoCreateDeal: body.autoCreateDeal === true,
        defaultSourceId: body.defaultSourceId ? Number(body.defaultSourceId) : null,
        defaultPipelineId: body.defaultPipelineId ? Number(body.defaultPipelineId) : null,
        defaultAssigneeId: defaultAssigneeId,
        settings: body.settings ?? undefined,
      },
      create: {
        platform: 'TELEGRAM',
        botToken: encrypt(botTokenToUse),
        isActive: body.isActive !== false,
        autoCreateContact: body.autoCreateContact !== false,
        autoCreateDeal: body.autoCreateDeal === true,
        defaultSourceId: body.defaultSourceId ? Number(body.defaultSourceId) : null,
        defaultPipelineId: body.defaultPipelineId ? Number(body.defaultPipelineId) : null,
        defaultAssigneeId: defaultAssigneeId,
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
    console.error("[telegram-bot][POST]", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Удалить Telegram Bot интеграцию компании
export async function DELETE() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const companyId = parseInt(user.companyId)

    await prisma.messagingIntegration.deleteMany({
      where: {
        companyId,
        platform: 'TELEGRAM',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[telegram-bot][DELETE]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
