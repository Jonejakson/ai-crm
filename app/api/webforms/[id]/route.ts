import { NextResponse, NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/get-session"
import { sanitizeFormFields, WebFormFieldsPayload } from "@/lib/webforms"
import { parsePipelineStages } from "@/lib/pipelines"
import { validateRequest, updateWebFormSchema } from "@/lib/validation"
import { z } from "zod"

type WebFormRequestPayload = {
  name?: string
  sourceId?: number | null
  pipelineId?: number | null
  initialStage?: string | null
  defaultAssigneeId?: number | null
  successMessage?: string | null
  redirectUrl?: string | null
  fields?: WebFormFieldsPayload | { fields?: unknown }
  isActive?: boolean
  displayType?: "inline" | "popup"
  buttonText?: string | null
}

async function ensureAccess(formId: number, companyId: number) {
  return prisma.webForm.findFirst({
    where: { id: formId, companyId },
    include: {
      source: { select: { id: true, name: true } },
      pipeline: { select: { id: true, name: true, stages: true } },
      defaultAssignee: { select: { id: true, name: true, email: true } },
    },
  })
}

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser()
  const authError = checkAdmin(user)
  if (authError) return authError

  try {
    const companyId = parseInt(user!.companyId)
    const { id: rawId } = await context.params
    const id = Number(rawId)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const form = await ensureAccess(id, companyId)
    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 })
    }

    return NextResponse.json(form)
  } catch (error) {
    console.error("[webforms][GET:id]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser()
  const authError = checkAdmin(user)
  if (authError) return authError

  try {
    const companyId = parseInt(user!.companyId)
    const { id: rawId } = await context.params
    const id = Number(rawId)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const existing = await prisma.webForm.findFirst({
      where: { id, companyId },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 })
    }

    const rawBody = await request.json()
    
    // Валидация с помощью Zod (частичное обновление)
    const partialSchema = updateWebFormSchema.partial().extend({ id: z.number().int().positive() })
    const validationResult = validateRequest(partialSchema, { ...rawBody, id })
    
    if (validationResult instanceof NextResponse) {
      return validationResult
    }
    
    const body = validationResult as WebFormRequestPayload
    const updateData: Prisma.WebFormUncheckedUpdateInput = {}

    if (body.name) updateData.name = String(body.name)
    if (body.successMessage !== undefined) {
      updateData.successMessage =
        typeof body.successMessage === "string" && body.successMessage.trim().length > 0
          ? body.successMessage.trim()
          : null
    }
    if (body.redirectUrl !== undefined) {
      updateData.redirectUrl =
        typeof body.redirectUrl === "string" && body.redirectUrl.trim().length > 0
          ? body.redirectUrl.trim()
          : null
    }
    if (body.isActive !== undefined) {
      updateData.isActive = Boolean(body.isActive)
    }
    if (body.displayType !== undefined) {
      updateData.displayType = body.displayType === "popup" ? "popup" : "inline"
    }
    if (body.buttonText !== undefined) {
      updateData.buttonText =
        body.displayType === "popup" && typeof body.buttonText === "string" && body.buttonText.trim().length > 0
          ? body.buttonText.trim()
          : null
    }
    if (body.fields) {
      updateData.fields = sanitizeFormFields(body.fields) as unknown as Prisma.InputJsonValue
    }
    if (body.sourceId !== undefined) {
      updateData.sourceId = body.sourceId ? Number(body.sourceId) : null
    }
    if (body.defaultAssigneeId !== undefined) {
      if (body.defaultAssigneeId) {
        const userExists = await prisma.user.findFirst({
          where: { id: Number(body.defaultAssigneeId), companyId },
          select: { id: true },
        })
        if (!userExists) {
          return NextResponse.json({ error: "Ответственный не найден" }, { status: 400 })
        }
        updateData.defaultAssigneeId = Number(body.defaultAssigneeId)
      } else {
        updateData.defaultAssigneeId = null
      }
    }
    if (body.pipelineId !== undefined || body.initialStage !== undefined) {
      const pipelineInfo = await resolvePipelineConfig(
        companyId,
        body.pipelineId !== undefined ? (body.pipelineId ? Number(body.pipelineId) : null) : undefined,
        body.initialStage
      )
      updateData.pipelineId = pipelineInfo.pipelineId
      updateData.initialStage = pipelineInfo.initialStage
    }

    const form = await prisma.webForm.update({
      where: { id },
      data: updateData,
      include: {
        source: { select: { id: true, name: true } },
        pipeline: { select: { id: true, name: true, stages: true } },
        defaultAssignee: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(form)
  } catch (error) {
    console.error("[webforms][PUT]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser()
  const authError = checkAdmin(user)
  if (authError) return authError

  try {
    const companyId = parseInt(user!.companyId)
    const { id: rawId } = await context.params
    const id = Number(rawId)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const existing = await prisma.webForm.findFirst({
      where: { id, companyId },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 })
    }

    await prisma.webForm.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[webforms][DELETE]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

function checkAdmin(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

async function resolvePipelineConfig(
  companyId: number,
  pipelineId?: number | null,
  desiredStage?: string | null
) {
  if (pipelineId === undefined) {
    return { pipelineId: undefined, initialStage: undefined }
  }

  if (!pipelineId) {
    return { pipelineId: null, initialStage: null }
  }

  const pipeline = await prisma.pipeline.findFirst({
    where: { id: pipelineId, companyId },
    select: { id: true, stages: true },
  })

  if (!pipeline) {
    throw new Error("Воронка не найдена")
  }

  const stages = parsePipelineStages(pipeline.stages)
  const names = stages.map((stage) => stage.name)
  const initialStage =
    desiredStage && names.includes(desiredStage) ? desiredStage : names[0] || "Новый лид"

  return { pipelineId: pipeline.id, initialStage }
}

