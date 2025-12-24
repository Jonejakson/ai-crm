import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'
import { BillingInterval, SubscriptionStatus } from '@prisma/client'

const ACTIVE_STATUSES = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIAL,
  SubscriptionStatus.PAST_DUE,
]

export async function GET() {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        companyId: Number(currentUser.companyId),
        status: { in: ACTIVE_STATUSES },
      },
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Проверяем, не истекла ли подписка
    if (subscription && subscription.currentPeriodEnd) {
      const now = new Date()
      const periodEnd = new Date(subscription.currentPeriodEnd)
      if (periodEnd < now) {
        // Подписка истекла, но возвращаем её для отображения
        return NextResponse.json({ 
          subscription: {
            ...subscription,
            expired: true,
          }
        })
      }
    }

    return NextResponse.json({ subscription })
  } catch (error) {
    console.error('[billing][subscription][GET]', error)
    return NextResponse.json({ error: 'Failed to load subscription' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { planId } = body as { planId?: number }

  if (!planId) {
    return NextResponse.json({ error: 'Plan is required' }, { status: 400 })
  }

  try {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const now = new Date()
    const nextPeriod = new Date(now)
    nextPeriod.setMonth(nextPeriod.getMonth() + 1)

    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        companyId: Number(currentUser.companyId),
        status: { in: ACTIVE_STATUSES },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        plan: true,
      },
    })

    if (activeSubscription && activeSubscription.planId === plan.id) {
      return NextResponse.json({ subscription: activeSubscription })
    }

    const subscription = await prisma.$transaction(async (tx) => {
      if (activeSubscription) {
        await tx.subscription.update({
          where: { id: activeSubscription.id },
          data: {
            status: SubscriptionStatus.CANCELED,
            cancelAtPeriodEnd: true,
          },
        })
      }

      return tx.subscription.create({
        data: {
          companyId: Number(currentUser.companyId),
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          billingInterval: BillingInterval.MONTHLY,
          currentPeriodEnd: nextPeriod,
        },
        include: {
          plan: true,
        },
      })
    })

    return NextResponse.json({ subscription })
  } catch (error) {
    console.error('[billing][subscription][POST]', error)
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
  }
}

