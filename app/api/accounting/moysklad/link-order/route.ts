import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'
import { decrypt } from '@/lib/encryption'
import { normalizeMoyskladSecret, makeMoyskladHeaders, type MoyskladAuthMode } from '@/lib/moysklad-auth'
import { extractPositionPriceAndSum } from '@/lib/moysklad-utils'

/**
 * Привязать существующую сделку к заказу МойСклад по ID заказа.
 * POST /api/accounting/moysklad/link-order { dealId: number, orderId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const dealId = body?.dealId != null ? Number(body.dealId) : null
    const orderId = body?.orderId ? String(body.orderId).trim() : null

    if (!dealId || !orderId) {
      return NextResponse.json({ error: 'dealId и orderId обязательны' }, { status: 400 })
    }

    const companyId = parseInt(user.companyId)

    const deal = await prisma.deal.findFirst({
      where: {
        id: dealId,
        user: { companyId },
      },
      select: { id: true, contactId: true },
    })

    if (!deal) {
      return NextResponse.json({ error: 'Сделка не найдена' }, { status: 404 })
    }

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
    const orderSum = typeof order.sum === 'number' ? order.sum / 100 : 0
    const orderName = order.name || `Заказ ${orderId}`

    await prisma.deal.update({
      where: { id: dealId },
      data: {
        externalId: orderId,
        syncedAt: new Date(),
        amount: orderSum,
        title: orderName,
      },
    })

    await prisma.dealMoyskladItem.deleteMany({ where: { dealId } })

    const posResp = await fetch(
      `${baseUrl}/entity/customerorder/${orderId}/positions?limit=1000&expand=assortment,assortment.product,assortment.salePrices,assortment.product.salePrices`,
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
        const { priceKopecks, sumKopecks } = extractPositionPriceAndSum(row as Record<string, unknown>)

        await prisma.dealMoyskladItem.create({
          data: {
            dealId,
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

    return NextResponse.json({
      message: 'Заказ из МойСклад привязан к сделке',
      dealId,
      orderId,
    })
  } catch (error) {
    console.error('[moysklad][link-order]', error)
    const msg = error instanceof Error ? error.message : 'Ошибка привязки заказа'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
