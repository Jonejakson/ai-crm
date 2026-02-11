import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'
import { BillingInterval, SubscriptionStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

/**
 * ВАЖНО:
 * - TRIAL в системе используется для реального 14-дневного пробного периода (имеет trialEndsAt),
 *   но также ранее использовался как "ожидается оплата" при создании неоплаченного инвойса.
 * - Чтобы не было ситуации "выбил ошибку → обновил страницу → тариф сам поменялся и продлился",
 *   мы считаем текущей подпиской только:
 *   1) ACTIVE и не истекшую по currentPeriodEnd
 *   2) TRIAL только если есть trialEndsAt и он не истек, и при этом нет PENDING инвойсов
 */

export async function GET() {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const companyId = Number(currentUser.companyId)
    if (!companyId || Number.isNaN(companyId) || companyId <= 0) {
      return NextResponse.json({ subscription: null })
    }

    const now = new Date()

    // 1) Сначала ищем реально активную подписку
    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        companyId,
        status: SubscriptionStatus.ACTIVE,
        OR: [
          { currentPeriodEnd: null },
          { currentPeriodEnd: { gt: now } },
        ],
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    })

    if (activeSubscription) {
      return NextResponse.json({ subscription: activeSubscription })
    }

    // 2) Если активной нет — возвращаем пробную (только настоящую trial) и только без неоплаченных инвойсов
    const trialSubscription = await prisma.subscription.findFirst({
      where: {
        companyId,
        status: SubscriptionStatus.TRIAL,
        trialEndsAt: { not: null, gt: now },
        invoices: {
          none: { status: 'PENDING' },
        },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ subscription: trialSubscription || null })
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

    // Защита от "самопереключения" платных тарифов без оплаты.
    // Платные планы должны активироваться через /api/billing/payment или /api/billing/invoice/generate.
    if (plan.price > 0) {
      return NextResponse.json(
        { error: 'Paid plans must be activated via payment. Use /api/billing/payment or /api/billing/invoice/generate' },
        { status: 400 }
      )
    }

    // Для бесплатного плана разрешаем мгновенную активацию (без платежа)
    const subscription = await prisma.subscription.create({
      data: {
        companyId: Number(currentUser.companyId),
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        billingInterval: BillingInterval.MONTHLY,
        currentPeriodEnd: null, // бесплатный план без окончания периода
      },
      include: { plan: true },
    })

    return NextResponse.json({ subscription })
  } catch (error) {
    console.error('[billing][subscription][POST]', error)
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
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
    const now = new Date()

    const trialSubscription = await prisma.subscription.findFirst({
      where: {
        companyId: Number(currentUser.companyId),
        status: SubscriptionStatus.TRIAL,
        trialEndsAt: { not: null, gt: now },
        invoices: {
          none: { status: 'PENDING' },
        },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    })

    if (!trialSubscription) {
      return NextResponse.json({ error: 'No active trial found' }, { status: 409 })
    }

    if (trialSubscription.planId === planId) {
      return NextResponse.json({ subscription: trialSubscription })
    }

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const updatedSubscription = await prisma.subscription.update({
      where: { id: trialSubscription.id },
      data: { planId: plan.id },
      include: { plan: true },
    })

    return NextResponse.json({ subscription: updatedSubscription })
  } catch (error) {
    console.error('[billing][subscription][PATCH]', error)
    return NextResponse.json({ error: 'Failed to update trial subscription' }, { status: 500 })
  }
}
