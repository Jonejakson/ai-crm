import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { sanitizeFormFields } from "@/lib/webforms"
import { parsePipelineStages } from "@/lib/pipelines"
import { processAutomations } from "@/lib/automations"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS })
}

type RouteContext = { params: Promise<{ token: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params
    const form = await prisma.webForm.findUnique({
      where: { token },
      include: {
        pipeline: true,
        defaultAssignee: { select: { id: true, companyId: true } },
      },
    })

    if (!form || !form.isActive) {
      return jsonResponse({ error: "Форма не найдена" }, 404)
    }

    const payload = await parseRequestPayload(request)
    const config = sanitizeFormFields(form.fields)

    const requiredFields = config.fields.filter((field) => field.enabled !== false && field.required)
    for (const field of requiredFields) {
      if (!payload[field.key]?.trim()) {
        return jsonResponse({ error: `Поле "${field.label}" обязательно` }, 400)
      }
    }

    const contactResult = await upsertContact({
      form,
      payload,
    })

    const stage = resolveStage(form)
    const assignedUserId = contactResult.assignedUserId

    const deal = await prisma.deal.create({
      data: {
        title: `Заявка: ${contactResult.contact.name || "Новый лид"} · ${form.name}`,
        amount: 0,
        currency: "RUB",
        stage,
        contactId: contactResult.contact.id,
        userId: assignedUserId,
        pipelineId: form.pipelineId,
        sourceId: form.sourceId,
        webFormId: form.id,
      },
    })

    await prisma.webFormSubmission.create({
      data: {
        webFormId: form.id,
        payload,
        ipAddress: getIpAddress(request),
        userAgent: request.headers.get("user-agent") || undefined,
        status: "success",
      },
    })

    await prisma.activityLog.create({
      data: {
        entityType: "deal",
        entityId: deal.id,
        action: "created",
        description: `Новая заявка через форму «${form.name}»`,
        metadata: { payload },
        companyId: form.companyId,
        userId: assignedUserId,
      },
    })

    if (contactResult.isNew) {
      await processAutomations("CONTACT_CREATED", {
        contactId: contactResult.contact.id,
        userId: contactResult.contact.userId || undefined,
        companyId: form.companyId,
      })
    }

    await processAutomations("DEAL_CREATED", {
      dealId: deal.id,
      contactId: contactResult.contact.id,
      userId: assignedUserId,
      companyId: form.companyId,
    })

    return jsonResponse(
      {
        success: true,
        message: form.successMessage || "Спасибо! Заявка успешно отправлена.",
        redirectUrl: form.redirectUrl || null,
      },
      200
    )
  } catch (error) {
    console.error("[webforms][submit]", error)
    return jsonResponse({ error: "Не удалось отправить форму" }, 500)
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  })
}

async function parseRequestPayload(request: Request) {
  const contentType = request.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    const data = await request.json()
    return typeof data === "object" && data ? data : {}
  }

  const formData = await request.formData()
  const result: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      result[key] = value
    }
  }
  return result
}

async function upsertContact({
  form,
  payload,
}: {
  form: {
    companyId: number
    defaultAssigneeId: number | null
  }
  payload: Record<string, string>
}) {
  const email = payload.email?.trim() || null
  const phone = payload.phone?.trim() || null
  const name = payload.name?.trim() || "Новый клиент"
  const companyName = payload.company?.trim() || null

  const whereConditions = []
  if (email) whereConditions.push({ email })
  if (phone) whereConditions.push({ phone })

  let existing = null
  if (whereConditions.length > 0) {
    existing = await prisma.contact.findFirst({
      where: {
        OR: whereConditions,
        user: {
          companyId: form.companyId,
        },
      },
    })
  }

  let assignedUserId = form.defaultAssigneeId || existing?.userId || null
  if (!assignedUserId) {
    const fallbackUser = await prisma.user.findFirst({
      where: { companyId: form.companyId },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })
    assignedUserId = fallbackUser?.id || null
  }

  if (!assignedUserId) {
    throw new Error("Для обработки формы требуется хотя бы один пользователь в компании")
  }

  let contact
  let isNew = false

  if (existing) {
    contact = await prisma.contact.update({
      where: { id: existing.id },
      data: {
        name,
        email: email ?? existing.email,
        phone: phone ?? existing.phone,
        company: companyName ?? existing.company,
        userId: existing.userId || assignedUserId,
      },
    })
  } else {
    contact = await prisma.contact.create({
      data: {
        name,
        email,
        phone,
        company: companyName,
        userId: assignedUserId,
      },
    })
    isNew = true
  }

  return { contact, assignedUserId: assignedUserId!, isNew }
}

function resolveStage(form: { pipeline?: { stages: string | null } | null; initialStage: string | null }) {
  if (form.initialStage) return form.initialStage
  const stages = parsePipelineStages(form.pipeline?.stages)
  return stages[0]?.name || "Новый лид"
}

function getIpAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0]?.trim()
  }
  return request.headers.get("x-real-ip") || undefined
}

