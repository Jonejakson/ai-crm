import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { getCurrentUser } from '@/lib/get-session'

// Простая ручка для фонового/cron синка заказов из МойСклад
// Защита: либо админ, либо заголовок X-Cron-Secret == CRON_SECRET

function isAuthorized(secretHeader: string | null, user: any) {
  const cronSecret = process.env.CRON_SECRET
  if (user && user.role === 'admin') return true
  if (cronSecret && secretHeader === cronSecret) return true
  return false
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser().catch(() => null)
  const headerSecret = request.headers.get('x-cron-secret')
  if (!isAuthorized(headerSecret, user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const limitParam = parseInt(url.searchParams.get('limit') || '20', 10)
  const perIntegrationLimit = Math.min(Math.max(limitParam, 1), 50) // 1..50

  try {
    const integrations = await prisma.accountingIntegration.findMany({
      where: {
        platform: 'MOYSKLAD',
        isActive: true,
        apiToken: { not: null },
        apiSecret: { not: null },
      },
      select: {
        id: true,
        companyId: true,
        apiToken: true,
        apiSecret: true,
      },
    })

    const results: any[] = []

    for (const integ of integrations) {
      const apiSecret = await decrypt(integ.apiSecret!)
      const apiToken = integ.apiToken!
      const authString = Buffer.from(`${apiToken}:${apiSecret}`).toString('base64')
      const baseUrl = 'https://api.moysklad.ru/api/remap/1.2'

      const deals = await prisma.deal.findMany({
        where: {
          externalId: { not: null },
          user: { companyId: integ.companyId },
        },
        orderBy: { updatedAt: 'desc' },
        take: perIntegrationLimit,
        select: { id: true, externalId: true, amount: true },
      })

      let updated = 0
      let errors = 0

      for (const d of deals) {
        if (!d.externalId) continue
        try {
          const resp = await fetch(`${baseUrl}/entity/customerorder/${d.externalId}`, {
            headers: {
              Authorization: `Basic ${authString}`,
              'Content-Type': 'application/json',
            },
            cache: 'no-store',
          })
          if (!resp.ok) {
            errors++
            continue
          }
          const order = await resp.json()
          const newAmount =
            typeof order.sum === 'number' ? Math.round(order.sum / 100) : d.amount
          await prisma.deal.update({
            where: { id: d.id },
            data: { amount: newAmount, syncedAt: new Date() },
          })
          updated++
        } catch (e) {
          errors++
          continue
        }
      }

      results.push({
        integrationId: integ.id,
        companyId: integ.companyId,
        processed: deals.length,
        updated,
        errors,
      })
    }

    return NextResponse.json({ success: true, results })
  } catch (error) {
    console.error('[moysklad][sync]', error)
    return NextResponse.json({ error: 'Failed to sync' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}


