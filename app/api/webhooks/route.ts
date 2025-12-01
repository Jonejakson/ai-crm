import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { getCurrentUser } from "@/lib/get-session"
import crypto from "crypto"
import { checkWebhookAccess } from "@/lib/subscription-limits"
import { validateRequest, createWebhookSchema } from "@/lib/validation"

// Получить все webhook интеграции компании
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
    const webhooks = await prisma.webhookIntegration.findMany({
      where: { companyId },
      include: {
        defaultAssignee: { select: { id: true, name: true, email: true } },
        defaultSource: { select: { id: true, name: true } },
        defaultPipeline: { select: { id: true, name: true } },
        _count: {
          select: { logs: true }
        }
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(webhooks)
  } catch (error) {
    console.error("[webhooks][GET]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// Создать новую webhook интеграцию
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
    
    // Проверка доступа к Webhook API
    const webhookAccess = await checkWebhookAccess(companyId)
    console.log('[webhooks][POST] Проверка доступа:', webhookAccess, 'companyId:', companyId)
    if (!webhookAccess.allowed) {
      console.log('[webhooks][POST] Доступ запрещен:', webhookAccess.message)
      return NextResponse.json(
        { error: webhookAccess.message || "Webhook API недоступен для вашего тарифа" },
        { status: 403 }
      )
    }

    const rawBody = await request.json()
    
    // Валидация с помощью Zod
    const validationResult = validateRequest(createWebhookSchema, rawBody)
    
    if (validationResult instanceof NextResponse) {
      return validationResult
    }
    
    const body = validationResult

    // Генерируем уникальный токен
    const token = crypto.randomBytes(32).toString('hex')

    const webhook = await prisma.webhookIntegration.create({
      data: {
        name: body.name || `Webhook ${new Date().toLocaleDateString()}`,
        token,
        description: body.description || null,
        isActive: body.isActive !== false,
        autoCreateContact: body.autoCreateContact !== false,
        autoCreateDeal: body.autoCreateDeal === true,
        defaultSourceId: body.defaultSourceId ? Number(body.defaultSourceId) : null,
        defaultPipelineId: body.defaultPipelineId ? Number(body.defaultPipelineId) : null,
        defaultAssigneeId: body.defaultAssigneeId ? Number(body.defaultAssigneeId) : null,
        fieldMapping: body.fieldMapping ? (body.fieldMapping as unknown as Prisma.InputJsonValue) : null,
        settings: body.settings ? (body.settings as unknown as Prisma.InputJsonValue) : null,
        companyId,
      },
      include: {
        defaultAssignee: { select: { id: true, name: true, email: true } },
        defaultSource: { select: { id: true, name: true } },
        defaultPipeline: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(webhook)
  } catch (error) {
    console.error("[webhooks][POST]", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

