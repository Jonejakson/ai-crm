import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/get-session"
import { sanitizeFormFields, WebFormFieldsPayload } from "@/lib/webforms"
import { parsePipelineStages } from "@/lib/pipelines"

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
}

function ensureAdmin(user: { role?: string } | null) {
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return null
}

export async function GET() {
  const user = await getCurrentUser()
  const authError = ensureAdmin(user)
  if (authError) return authError

  try {
    const companyId = parseInt(user!.companyId)
    const forms = await prisma.webForm.findMany({
      where: { companyId },
      include: {
        source: { select: { id: true, name: true } },
        pipeline: { select: { id: true, name: true, stages: true } },
        defaultAssignee: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(forms)
  } catch (error) {
    console.error("[webforms][GET]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  const authError = ensureAdmin(user)
  if (authError) return authError

  try {
    const body = (await request.json()) as WebFormRequestPayload
    if (!body?.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "Название обязательно" }, { status: 400 })
    }

    const companyId = parseInt(user!.companyId)
    const fieldsConfig = sanitizeFormFields(body.fields) as unknown as Prisma.InputJsonValue

    const pipelineInfo = await resolvePipelineConfig(
      companyId,
      body.pipelineId ? Number(body.pipelineId) : null,
      body.initialStage
    )
    const assigneeId = body.defaultAssigneeId ? Number(body.defaultAssigneeId) : null
    if (assigneeId) {
      const isMember = await prisma.user.findFirst({
        where: { id: assigneeId, companyId },
        select: { id: true },
      })
      if (!isMember) {
        return NextResponse.json({ error: "Ответственный не найден" }, { status: 400 })
      }
    }

    const form = await prisma.webForm.create({
      data: {
        name: body.name.trim(),
        token: crypto.randomUUID(),
        companyId,
        fields: fieldsConfig,
        successMessage:
          typeof body.successMessage === "string" && body.successMessage.trim().length > 0
            ? body.successMessage.trim()
            : null,
        redirectUrl:
          typeof body.redirectUrl === "string" && body.redirectUrl.trim().length > 0
            ? body.redirectUrl.trim()
            : null,
        isActive: body.isActive !== false,
        sourceId: body.sourceId ? Number(body.sourceId) : null,
        pipelineId: pipelineInfo.pipelineId,
        initialStage: pipelineInfo.initialStage,
        defaultAssigneeId: assigneeId,
      },
    })

    return NextResponse.json(form)
  } catch (error) {
    console.error("[webforms][POST]", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function resolvePipelineConfig(
  companyId: number,
  pipelineId: number | null,
  requestedStage?: string | null
) {
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
  const stageNames = stages.map((stage) => stage.name)
  const initialStage =
    requestedStage && stageNames.includes(requestedStage) ? requestedStage : stageNames[0] || "Новый лид"

  return { pipelineId: pipeline.id, initialStage }
}

