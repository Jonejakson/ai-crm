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
    // Ищем любую подписку компании: ACTIVE или TRIAL (включая с PENDING инвойсами)
    const subscription = await prisma.subscription.findFirst({
      where: {
        companyId: Number(currentUser.companyId),
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!subscription) {
      return NextResponse.json({ endDate: null })
    }

    const endDate = subscription.currentPeriodEnd ?? subscription.trialEndsAt
    if (!endDate) {
      return NextResponse.json({ endDate: null })
    }

    return NextResponse.json({ endDate: endDate.toISOString() })
  } catch (error) {
    console.error('[billing][expiry][GET]', error)
    return NextResponse.json({ error: 'Failed to load expiry' }, { status: 500 })
  }
}
