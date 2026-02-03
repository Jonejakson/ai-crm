import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'
import { decrypt } from '@/lib/encryption'
import { normalizeMoyskladSecret, makeMoyskladHeaders, type MoyskladAuthMode } from '@/lib/moysklad-auth'

// Временный endpoint для отладки структуры позиций МойСклад
// GET /api/accounting/moysklad/debug-positions?orderId=xxx  или  ?dealId=123
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let orderId = request.nextUrl.searchParams.get('orderId')
    const dealId = request.nextUrl.searchParams.get('dealId')
    if (!orderId && dealId) {
      const deal = await prisma.deal.findFirst({
        where: { id: Number(dealId), user: { companyId: parseInt(user.companyId) } },
        select: { externalId: true },
      })
      orderId = deal?.externalId || null
    }
    if (!orderId) return NextResponse.json({ error: 'orderId или dealId required' }, { status: 400 })

    const companyId = parseInt(user.companyId)
    const integration = await prisma.accountingIntegration.findFirst({
      where: { companyId, platform: 'MOYSKLAD', isActive: true, apiToken: { not: null }, apiSecret: { not: null } },
    })
    if (!integration?.apiSecret || !integration.apiToken) {
      return NextResponse.json({ error: 'МойСклад не настроен' }, { status: 404 })
    }

    const apiSecret = normalizeMoyskladSecret(await decrypt(integration.apiSecret)).secret
    const authMode: MoyskladAuthMode = (integration.settings as any)?.moyskladAuthMode === 'bearer' ? 'bearer' : 'basic'
    const authHeaders = makeMoyskladHeaders({ mode: authMode, login: integration.apiToken, secret: apiSecret })
    const baseUrl = 'https://api.moysklad.ru/api/remap/1.2'

    const resp = await fetch(
      `${baseUrl}/entity/customerorder/${orderId}/positions?limit=3&expand=assortment,assortment.product,assortment.salePrices,assortment.product.salePrices`,
      { headers: authHeaders, cache: 'no-store' }
    )
    if (!resp.ok) return NextResponse.json({ error: `HTTP ${resp.status}` }, { status: resp.status })

    const data = await resp.json()
    const rows = Array.isArray(data?.rows) ? data.rows : []
    const firstRow = rows[0] || null

    const { extractKopecks } = await import('@/lib/moysklad-utils')
    const priceKopecks = firstRow ? extractKopecks(firstRow.price) || extractKopecks((firstRow as any).salePrice) : 0
    const sumKopecks = firstRow ? extractKopecks(firstRow.sum) || extractKopecks((firstRow as any).totalSum) : 0

    return NextResponse.json({
      totalRows: rows.length,
      firstRowRaw: firstRow,
      firstRowKeys: firstRow ? Object.keys(firstRow) : [],
      priceType: firstRow?.price ? typeof firstRow.price : 'undefined',
      sumType: firstRow?.sum ? typeof firstRow.sum : 'undefined',
      extracted: { priceKopecks, sumKopecks, priceRUB: priceKopecks / 100, sumRUB: sumKopecks / 100 },
    })
  } catch (e) {
    console.error('[moysklad][debug]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
