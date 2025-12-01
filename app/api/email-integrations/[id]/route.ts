import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/get-session"
import { encryptPassword } from "@/lib/encryption"
import { validateRequest, updateEmailIntegrationSchema } from "@/lib/validation"
import { z } from "zod"

type RouteContext = { params: Promise<{ id: string }> }

// Получить конкретную интеграцию
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
    const integration = await prisma.emailIntegration.findFirst({
      where: { id, companyId },
      include: {
        defaultAssignee: { select: { id: true, name: true, email: true } },
        defaultSource: { select: { id: true, name: true } },
        defaultPipeline: { select: { id: true, name: true } },
      },
    })

    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 })
    }

    return NextResponse.json(integration)
  } catch (error) {
    console.error("[email-integrations][GET:id]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// Обновить интеграцию
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

    const companyId = parseInt(user.companyId)
    const existing = await prisma.emailIntegration.findFirst({
      where: { id, companyId },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 })
    }

    const rawBody = await request.json()
    
    // Валидация с помощью Zod (частичное обновление)
    const partialSchema = updateEmailIntegrationSchema.partial().extend({ id: z.number().int().positive() })
    const validationResult = validateRequest(partialSchema, { ...rawBody, id })
    
    if (validationResult instanceof NextResponse) {
      return validationResult
    }
    
    const body = validationResult
    const updateData: any = {}

    if (body.email !== undefined) updateData.email = body.email
    if (body.displayName !== undefined) updateData.displayName = body.displayName
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive)
    if (body.isIncomingEnabled !== undefined) updateData.isIncomingEnabled = Boolean(body.isIncomingEnabled)
    if (body.isOutgoingEnabled !== undefined) updateData.isOutgoingEnabled = Boolean(body.isOutgoingEnabled)
    
    // IMAP/SMTP
    if (body.imapHost !== undefined) updateData.imapHost = body.imapHost || null
    if (body.imapPort !== undefined) updateData.imapPort = body.imapPort || null
    if (body.imapUsername !== undefined) updateData.imapUsername = body.imapUsername || null
    if (body.imapPassword !== undefined) {
      updateData.imapPassword = body.imapPassword ? encryptPassword(body.imapPassword) : null
    }
    if (body.smtpHost !== undefined) updateData.smtpHost = body.smtpHost || null
    if (body.smtpPort !== undefined) updateData.smtpPort = body.smtpPort || null
    if (body.smtpUsername !== undefined) updateData.smtpUsername = body.smtpUsername || null
    if (body.smtpPassword !== undefined) {
      updateData.smtpPassword = body.smtpPassword ? encryptPassword(body.smtpPassword) : null
    }
    if (body.useSSL !== undefined) updateData.useSSL = Boolean(body.useSSL)
    
    // OAuth
    if (body.accessToken !== undefined) {
      updateData.accessToken = body.accessToken ? encryptPassword(body.accessToken) : null
    }
    if (body.refreshToken !== undefined) {
      updateData.refreshToken = body.refreshToken ? encryptPassword(body.refreshToken) : null
    }
    if (body.tokenExpiresAt !== undefined) {
      updateData.tokenExpiresAt = body.tokenExpiresAt ? new Date(body.tokenExpiresAt) : null
    }
    
    // Настройки синхронизации
    if (body.syncInterval !== undefined) updateData.syncInterval = Number(body.syncInterval) || 5
    if (body.autoCreateContact !== undefined) updateData.autoCreateContact = Boolean(body.autoCreateContact)
    if (body.autoCreateDeal !== undefined) updateData.autoCreateDeal = Boolean(body.autoCreateDeal)
    if (body.defaultSourceId !== undefined) {
      updateData.defaultSourceId = body.defaultSourceId ? Number(body.defaultSourceId) : null
    }
    if (body.defaultPipelineId !== undefined) {
      updateData.defaultPipelineId = body.defaultPipelineId ? Number(body.defaultPipelineId) : null
    }
    if (body.defaultAssigneeId !== undefined) {
      updateData.defaultAssigneeId = body.defaultAssigneeId ? Number(body.defaultAssigneeId) : null
    }
    if (body.settings !== undefined) updateData.settings = body.settings || null

    const integration = await prisma.emailIntegration.update({
      where: { id },
      data: updateData,
      include: {
        defaultAssignee: { select: { id: true, name: true, email: true } },
        defaultSource: { select: { id: true, name: true } },
        defaultPipeline: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(integration)
  } catch (error) {
    console.error("[email-integrations][PUT]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// Удалить интеграцию
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
    const existing = await prisma.emailIntegration.findFirst({
      where: { id, companyId },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 })
    }

    await prisma.emailIntegration.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[email-integrations][DELETE]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}


