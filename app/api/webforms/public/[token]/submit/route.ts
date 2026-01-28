import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { sanitizeFormFields } from "@/lib/webforms"
import { parsePipelineStages } from "@/lib/pipelines"
import { processAutomations } from "@/lib/automations"
import { createNotification } from "@/lib/notifications"

const allowedOriginsEnv =
  process.env.WEBFORM_ALLOWED_ORIGINS ||
  process.env.ALLOWED_ORIGINS ||
  process.env.NEXT_PUBLIC_WEBFORM_ALLOWED_ORIGINS ||
  ''

function parseAllowedOrigins() {
  return allowedOriginsEnv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function getAllowedOrigin(originHeader: string | null) {
  const allowed = parseAllowedOrigins()
  if (allowed.length === 0) return '*'
  if (!originHeader) return allowed[0] || '*'
  if (allowed.includes(originHeader)) return originHeader
  return null
}

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || 'null',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  const allowedOrigin = getAllowedOrigin(origin)
  if (!allowedOrigin) {
    return new Response(null, { status: 403, headers: corsHeaders(null) })
  }
  return new Response(null, { headers: corsHeaders(allowedOrigin) })
}

type RouteContext = { params: Promise<{ token: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params
    const origin = request.headers.get('origin')
    const allowedOrigin = getAllowedOrigin(origin)
    if (!allowedOrigin) {
      return jsonResponse({ error: 'Origin not allowed' }, 403, corsHeaders(null))
    }
    const form = await prisma.webForm.findUnique({
      where: { token },
      include: {
        pipeline: true,
        defaultAssignee: { select: { id: true, companyId: true } },
      },
    })

    if (!form || !form.isActive) {
      return jsonResponse({ error: "Форма не найдена" }, 404, corsHeaders(allowedOrigin))
    }

    const payload = await parseRequestPayload(request)
    const config = sanitizeFormFields(form.fields)

    const requiredFields = config.fields.filter((field) => field.enabled !== false && field.required)
    for (const field of requiredFields) {
      if (!payload[field.key]?.trim()) {
        return jsonResponse({ error: `Поле "${field.label}" обязательно` }, 400, corsHeaders(allowedOrigin))
      }
    }

    // Honeypot
    if (isHoneypotTriggered(payload)) {
      return jsonResponse({ error: 'Spam detected' }, 400, corsHeaders(allowedOrigin))
    }

    // Ограничение длины полей (простая валидация)
    const MAX_FIELD_LENGTH = parseInt(process.env.WEBFORM_MAX_FIELD_LENGTH || '2000', 10)
    for (const [k, v] of Object.entries(payload)) {
      if (typeof v === 'string' && v.length > MAX_FIELD_LENGTH) {
        return jsonResponse({ error: `Поле "${k}" слишком длинное` }, 400, corsHeaders(allowedOrigin))
      }
    }

    // Rate limit по IP за окно времени
    const ip = getIpAddress(request)
    const windowMinutes = parseInt(process.env.WEBFORM_RATE_WINDOW_MINUTES || '10', 10)
    const limit = parseInt(process.env.WEBFORM_RATE_LIMIT || '20', 10)
    if (ip && limit > 0 && windowMinutes > 0) {
      const since = new Date(Date.now() - windowMinutes * 60 * 1000)
      const count = await prisma.webFormSubmission.count({
        where: { ipAddress: ip, createdAt: { gt: since } },
      })
      if (count >= limit) {
        return jsonResponse({ error: 'Too many requests' }, 429, corsHeaders(allowedOrigin))
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

    // Создаем уведомление о новой заявке (встроенные веб-формы не требуют настроек автоматизаций)
    const contactName = contactResult.contact.name || "Новый клиент"
    const title = "Новая заявка с сайта"
    const message = `Форма «${form.name}»: ${contactName}`

    // Всегда уведомляем ответственного по заявке
    await createNotification({
      userId: assignedUserId,
      title,
      message,
      type: "info",
      entityType: "deal",
      entityId: deal.id,
    })

    // Если в форме не задан ответственный — дополнительно уведомляем админов/менеджеров компании,
    // чтобы заявка точно не потерялась.
    if (!form.defaultAssigneeId) {
      const watchers = await prisma.user.findMany({
        where: {
          companyId: form.companyId,
          role: { in: ["admin", "manager"] },
        },
        select: { id: true },
      })
      await Promise.all(
        watchers
          .map((u) => u.id)
          .filter((id) => id !== assignedUserId)
          .map((userId) =>
            createNotification({
              userId,
              title,
              message,
              type: "info",
              entityType: "deal",
              entityId: deal.id,
            })
          )
      )
    }

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
      200,
      corsHeaders(allowedOrigin)
    )
  } catch (error) {
    console.error("[webforms][submit]", error)
    const origin = request.headers.get('origin')
    const allowedOrigin = getAllowedOrigin(origin)
    return jsonResponse({ error: "Не удалось отправить форму" }, 500, corsHeaders(allowedOrigin || null))
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200, headers?: Record<string, string>) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(headers || corsHeaders('*')),
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

// Honeypot защита: если поле заполнено — считаем ботом
function isHoneypotTriggered(payload: Record<string, string>) {
  const honeypotField =
    process.env.WEBFORM_HONEYPOT_FIELD ||
    process.env.HONEYPOT_FIELD ||
    process.env.NEXT_PUBLIC_WEBFORM_HONEYPOT_FIELD ||
    'website'
  const val = payload[honeypotField]
  return typeof val === 'string' && val.trim().length > 0
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

