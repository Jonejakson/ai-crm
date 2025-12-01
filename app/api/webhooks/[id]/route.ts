import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { getCurrentUser } from "@/lib/get-session"
import crypto from "crypto"
import { validateRequest, updateWebhookSchema } from "@/lib/validation"
import { z } from "zod"

type RouteContext = { params: Promise<{ id: string }> }

// Получить webhook интеграцию
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id: rawId } = await context.params
    const id = Number(rawId)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const companyId = parseInt(user.companyId)
    const webhook = await prisma.webhookIntegration.findFirst({
      where: { id, companyId },
      include: {
        defaultAssignee: { select: { id: true, name: true, email: true } },
        defaultSource: { select: { id: true, name: true } },
        defaultPipeline: { select: { id: true, name: true } },
        _count: {
          select: { logs: true }
        }
      },
    })

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
    }

    return NextResponse.json(webhook)
  } catch (error) {
    console.error("[webhooks][GET]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// Обновить webhook интеграцию
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id: rawId } = await context.params
    const id = Number(rawId)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const rawBody = await request.json()
    
    // Валидация с помощью Zod (частичное обновление)
    const partialSchema = updateWebhookSchema.partial().extend({ id: z.number().int().positive() })
    const validationResult = validateRequest(partialSchema, { ...rawBody, id })
    
    if (validationResult instanceof NextResponse) {
      return validationResult
    }
    
    const body = validationResult
    const companyId = parseInt(user.companyId)

    const webhook = await prisma.webhookIntegration.findFirst({
      where: { id, companyId },
    })

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
    }

    const updateData: any = {}
    
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.isActive !== undefined) updateData.isActive = body.isActive
    if (body.autoCreateContact !== undefined) updateData.autoCreateContact = body.autoCreateContact
    if (body.autoCreateDeal !== undefined) updateData.autoCreateDeal = body.autoCreateDeal
    if (body.defaultSourceId !== undefined) {
      updateData.defaultSourceId = body.defaultSourceId ? Number(body.defaultSourceId) : null
    }
    if (body.defaultPipelineId !== undefined) {
      updateData.defaultPipelineId = body.defaultPipelineId ? Number(body.defaultPipelineId) : null
    }
    if (body.defaultAssigneeId !== undefined) {
      updateData.defaultAssigneeId = body.defaultAssigneeId ? Number(body.defaultAssigneeId) : null
    }
    if (body.fieldMapping !== undefined) {
      updateData.fieldMapping = body.fieldMapping 
        ? (body.fieldMapping as unknown as Prisma.InputJsonValue) 
        : Prisma.JsonNull
    }
    if (body.settings !== undefined) {
      updateData.settings = body.settings 
        ? (body.settings as unknown as Prisma.InputJsonValue) 
        : Prisma.JsonNull
    }

    const updated = await prisma.webhookIntegration.update({
      where: { id },
      data: updateData,
      include: {
        defaultAssignee: { select: { id: true, name: true, email: true } },
        defaultSource: { select: { id: true, name: true } },
        defaultPipeline: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[webhooks][PUT]", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Удалить webhook интеграцию
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id: rawId } = await context.params
    const id = Number(rawId)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const companyId = parseInt(user.companyId)
    const webhook = await prisma.webhookIntegration.findFirst({
      where: { id, companyId },
    })

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
    }

    await prisma.webhookIntegration.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[webhooks][DELETE]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// Регенерировать токен
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id: rawId } = await context.params
    const id = Number(rawId)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const body = await request.json()
    if (body.action !== "regenerate_token") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const companyId = parseInt(user.companyId)
    const webhook = await prisma.webhookIntegration.findFirst({
      where: { id, companyId },
    })

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
    }

    // Генерируем новый токен
    const newToken = crypto.randomBytes(32).toString('hex')

    const updated = await prisma.webhookIntegration.update({
      where: { id },
      data: { token: newToken },
      include: {
        defaultAssignee: { select: { id: true, name: true, email: true } },
        defaultSource: { select: { id: true, name: true } },
        defaultPipeline: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[webhooks][PATCH]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

