import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'
import { SubscriptionStatus } from '@prisma/client'

/**
 * Возвращает дату окончания подписки для отображения уведомления в шапке.
 * Используется даже при наличии ожидающих счетов (PENDING invoices).
 */
export async function GET() {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const companyId = Number(currentUser.companyId)

    // Ищем подписки с датой окончания (ACTIVE, TRIAL, PAST_DUE — включая с PENDING инвойсами)
    const subscriptions = await prisma.subscription.findMany({
      where: {
        companyId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.PAST_DUE] },
        OR: [
          { currentPeriodEnd: { not: null } },
          { trialEndsAt: { not: null } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    })

    // Берём подписку с самой поздней датой окончания
    let endDate: Date | null = null
    for (const sub of subscriptions) {
      const d = sub.currentPeriodEnd ?? sub.trialEndsAt
      if (d && (!endDate || d > endDate)) {
        endDate = d
      }
    }

    // Fallback: trialEndsAt на уровне компании
    if (!endDate) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { trialEndsAt: true },
      })
      if (company?.trialEndsAt) {
        endDate = company.trialEndsAt
      }
    }

    if (!endDate) {
      return NextResponse.json({ endDate: null })
    }

    return NextResponse.json({ endDate: endDate.toISOString() })
  } catch (error) {
    console.error('[billing][expiry][GET]', error)
    return NextResponse.json({ error: 'Failed to load expiry' }, { status: 500 })
  }
}
