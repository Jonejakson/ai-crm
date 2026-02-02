import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'
import { decrypt } from '@/lib/encryption'
import { normalizeMoyskladSecret, makeMoyskladHeaders, type MoyskladAuthMode } from '@/lib/moysklad-auth'
import { parsePipelineStages } from '@/lib/pipelines'

// Импорт заказа из МойСклад в CRM: создаёт контакт (из контрагента) и сделку
// POST /api/accounting/moysklad/import { orderId: string }

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const orderId = body?.orderId ? String(body.orderId).trim() : null
    const pipelineIdParam = body?.pipelineId ? Number(body.pipelineId) : null

    if (!orderId) {
      return NextResponse.json({ error: 'orderId обязателен' }, { status: 400 })
    }

    const companyId = parseInt(user.companyId)
    const userId = parseInt(user.id)

    const integration = await prisma.accountingIntegration.findFirst({
      where: {
        companyId,
        platform: 'MOYSKLAD',
        isActive: true,
        apiToken: { not: null },
        apiSecret: { not: null },
      },
    })

    if (!integration || !integration.apiSecret || !integration.apiToken) {
      return NextResponse.json({ error: 'МойСклад интеграция не настроена' }, { status: 404 })
    }

    const apiSecret = normalizeMoyskladSecret(await decrypt(integration.apiSecret)).secret
    const apiToken = integration.apiToken
    const authMode: MoyskladAuthMode =
      (integration.settings as any)?.moyskladAuthMode === 'bearer' ? 'bearer' : 'basic'
    const authHeaders = makeMoyskladHeaders({ mode: authMode, login: apiToken, secret: apiSecret })
    const baseUrl = 'https://api.moysklad.ru/api/remap/1.2'

    // 1. Получаем заказ с контрагентом
    const orderResp = await fetch(
      `${baseUrl}/entity/customerorder/${orderId}?expand=agent`,
      {
        headers: authHeaders,
        cache: 'no-store',
      }
    )

    if (!orderResp.ok) {
      const errData = await orderResp.json().catch(() => ({}))
      const msg = errData?.errors?.[0]?.error || `Заказ не найден (HTTP ${orderResp.status})`
      return NextResponse.json({ error: msg }, { status: 404 })
    }

    const order = await orderResp.json()
    const agent = order.agent
    if (!agent) {
      return NextResponse.json({ error: 'У заказа нет контрагента' }, { status: 400 })
    }

    // Контрагент может быть в meta или развёрнут (expand=agent)
    let counterparty = agent
    if (agent.meta && !agent.name) {
      const cpResp = await fetch(agent.meta.href, {
        headers: authHeaders,
        cache: 'no-store',
      })
      if (!cpResp.ok) {
        return NextResponse.json({ error: 'Не удалось загрузить контрагента' }, { status: 500 })
      }
      counterparty = await cpResp.json()
    }

    const counterpartyId = counterparty.id
    const cpName = counterparty.name || 'Контрагент без имени'
    const cpEmail = counterparty.email || null
    const cpPhone = counterparty.phone || null
    const cpLegalTitle = counterparty.legalTitle || null
    const cpInn = counterparty.inn || null

    // 2. Ищем или создаём контакт
    let contact = await prisma.contact.findFirst({
      where: {
        externalId: counterpartyId,
        user: { companyId },
      },
    })

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          name: cpName,
          email: cpEmail || undefined,
          phone: cpPhone || undefined,
          company: cpLegalTitle || undefined,
          inn: cpInn || undefined,
          externalId: counterpartyId,
          syncedAt: new Date(),
          userId,
        },
      })
    }

    // 3. Проверяем, нет ли уже сделки по этому заказу
    const existingDeal = await prisma.deal.findFirst({
      where: {
        externalId: orderId,
        user: { companyId },
      },
    })

    if (existingDeal) {
      return NextResponse.json({
        contactId: contact.id,
        dealId: existingDeal.id,
        message: 'Сделка по этому заказу уже есть в CRM',
      })
    }

    // 4. Воронка и этап
    const pipeline = await prisma.pipeline.findFirst({
      where: pipelineIdParam
        ? { id: pipelineIdParam, companyId }
        : { companyId, isDefault: true },
    })

    if (!pipeline) {
      return NextResponse.json({ error: 'Нет воронки в компании' }, { status: 400 })
    }

    const stages = parsePipelineStages(pipeline.stages)
    const firstStage = stages[0]?.name || 'Новая'

    const orderSum = typeof order.sum === 'number' ? order.sum / 100 : 0
    const orderName = order.name || `Заказ ${orderId}`

    // 5. Создаём сделку
    const deal = await prisma.deal.create({
      data: {
        title: orderName,
        amount: orderSum,
        currency: 'RUB',
        stage: firstStage,
        probability: stages[0] ? Math.min(100, Math.max(0, stages[0].probability ?? 0)) : 0,
        contactId: contact.id,
        userId,
        pipelineId: pipeline.id,
        externalId: orderId,
        syncedAt: new Date(),
      },
    })

    // 6. Позиции заказа → DealMoyskladItem
    try {
      const posResp = await fetch(
        `${baseUrl}/entity/customerorder/${orderId}/positions?limit=1000&expand=assortment,assortment.product`,
        {
          headers: authHeaders,
          cache: 'no-store',
        }
      )
      if (posResp.ok) {
        const posData = await posResp.json()
        const rows = Array.isArray(posData?.rows) ? posData.rows : []
        for (const row of rows) {
          const positionId = String(row.id)
          const href = row.assortment?.meta?.href
          const assortmentId = row.assortment?.id
            ? String(row.assortment.id)
            : href
              ? href.split('/').filter(Boolean).pop() ?? null
              : null
          const name =
            row.assortment?.name ||
            (row.assortment as any)?.product?.name ||
            row.name ||
            (assortmentId ? `Номенклатура ${assortmentId}` : 'Позиция')
          const quantity = typeof row.quantity === 'number' ? row.quantity : Number(row.quantity || 0)
          const priceKopecks = typeof row.price === 'number' ? row.price : Number(row.price || 0)
          const sumKopecks = typeof row.sum === 'number' ? row.sum : Number(row.sum || 0)

          await prisma.dealMoyskladItem.upsert({
            where: { dealId_positionId: { dealId: deal.id, positionId } },
            update: {
              moyskladOrderId: orderId,
              assortmentId,
              name,
              quantity,
              priceKopecks,
              sumKopecks,
            },
            create: {
              dealId: deal.id,
              moyskladOrderId: orderId,
              positionId,
              assortmentId,
              name,
              quantity,
              priceKopecks,
              sumKopecks,
            },
          })
        }
      }
    } catch (e) {
      console.warn('[moysklad][import] positions', e)
    }

    return NextResponse.json({
      contactId: contact.id,
      dealId: deal.id,
      message: 'Контакт и сделка созданы из заказа МойСклад',
    })
  } catch (error) {
    console.error('[moysklad][import]', error)
    const msg = error instanceof Error ? error.message : 'Ошибка импорта'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
