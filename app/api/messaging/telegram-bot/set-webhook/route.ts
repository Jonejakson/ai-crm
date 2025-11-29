import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/get-session"

// Установить webhook URL в Telegram
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { webhookUrl } = body

    if (!webhookUrl || !webhookUrl.trim()) {
      return NextResponse.json({ error: "Webhook URL is required" }, { status: 400 })
    }

    const companyId = parseInt(user.companyId)
    const integration = await prisma.messagingIntegration.findFirst({
      where: {
        companyId,
        platform: 'TELEGRAM',
        botToken: { not: null },
      },
    })

    if (!integration || !integration.botToken) {
      return NextResponse.json({ error: "Telegram bot integration not found" }, { status: 404 })
    }

    // Устанавливаем webhook в Telegram
    const setWebhookResponse = await fetch(
      `https://api.telegram.org/bot${integration.botToken}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl.trim(),
        }),
      }
    )

    const setWebhookData = await setWebhookResponse.json()

    if (!setWebhookData.ok) {
      return NextResponse.json(
        { error: setWebhookData.description || "Failed to set webhook" },
        { status: 400 }
      )
    }

    // Сохраняем webhook URL в базу
    await prisma.messagingIntegration.update({
      where: { id: integration.id },
      data: { webhookUrl: webhookUrl.trim() },
    })

    return NextResponse.json({ success: true, message: "Webhook set successfully" })
  } catch (error) {
    console.error("[telegram-bot][set-webhook]", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

