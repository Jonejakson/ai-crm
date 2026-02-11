import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'
import { SubscriptionStatus } from '@prisma/client'
import { calculateProratedPeriodEnd } from '@/lib/invoice-utils'

/**
 * GET ?planId=… — превью перерасчёта при смене тарифа (остаток по дням, новая дата окончания).
 * POST { planId } — применить смену тарифа с перерасчётом (без доплаты).
 * Доступ: авторизованный пользователь своей компании.
 */

async function getActiveSubscription(companyId: number) {
  const now = new Date()
  const subs = await prisma.subscription.findMany({
    where: {
      companyId,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: { not: null, gt: now },
    },
    include: { plan: true },
    orderBy: { currentPeriodEnd: 'desc' },
  })
  return subs[0] ?? null
}

export async function GET(request: Request) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const companyId = Number(currentUser.companyId)
  if (!companyId || Number.isNaN(companyId)) {
    return NextResponse.json({ error: 'Company not found' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const planIdParam = searchParams.get('planId')
  const planId = planIdParam ? parseInt(planIdParam, 10) : NaN
  if (!planId || Number.isNaN(planId)) {
    return NextResponse.json({ error: 'planId is required' }, { status: 400 })
  }

  try {
    const subscription = await getActiveSubscription(companyId)
    if (!subscription?.currentPeriodEnd) {
      return NextResponse.json({
        canProrate: false,
        reason: 'no_active_period',
        message: 'Перерасчёт возможен только при активной платной подписке с периодом.',
      })
    }

    const oldPrice = subscription.plan.price ?? 0
    if (oldPrice <= 0) {
      return NextResponse.json({
        canProrate: false,
        reason: 'current_plan_free',
        message: 'Перерасчёт возможен только при смене с платного тарифа.',
      })
    }

    const newPlan = await prisma.plan.findUnique({ where: { id: planId } })
    if (!newPlan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (subscription.planId === planId) {
      return NextResponse.json({
        canProrate: false,
        reason: 'same_plan',
        message: 'Уже подключен этот тариф.',
      })
    }

    const newPrice = newPlan.price ?? 0
    if (newPrice <= 0) {
      return NextResponse.json({
        canProrate: false,
        reason: 'new_plan_free',
        message: 'Переход на бесплатный тариф без перерасчёта.',
      })
    }

    const now = new Date()
    const proration = calculateProratedPeriodEnd(
      now,
      subscription.currentPeriodEnd,
      oldPrice,
      newPrice,
      30
    )

    return NextResponse.json({
      canProrate: true,
      newPeriodEnd: proration.newPeriodEnd.toISOString(),
      remainingDays: Math.round(proration.remainingDays * 10) / 10,
      credit: Math.round(proration.credit),
      daysAtNewRate: Math.round(proration.daysAtNewRate * 10) / 10,
      newPlanName: newPlan.name,
    })
  } catch (error) {
    console.error('[billing][change-plan][GET]', error)
    return NextResponse.json({ error: 'Failed to get preview' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: only company admin can change plan' }, { status: 403 })
  }

  const companyId = Number(currentUser.companyId)
  if (!companyId || Number.isNaN(companyId)) {
    return NextResponse.json({ error: 'Company not found' }, { status: 400 })
  }

  let body: { planId?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { planId } = body
  if (!planId || typeof planId !== 'number') {
    return NextResponse.json({ error: 'planId is required' }, { status: 400 })
  }

  try {
    const subscription = await getActiveSubscription(companyId)
    if (!subscription?.currentPeriodEnd) {
      return NextResponse.json(
        { error: 'Перерасчёт возможен только при активной платной подписке с периодом.' },
        { status: 400 }
      )
    }

    const oldPrice = subscription.plan.price ?? 0
    if (oldPrice <= 0) {
      return NextResponse.json(
        { error: 'Перерасчёт возможен только при смене с платного тарифа.' },
        { status: 400 }
      )
    }

    const newPlan = await prisma.plan.findUnique({ where: { id: planId } })
    if (!newPlan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (subscription.planId === planId) {
      return NextResponse.json(
        { error: 'Уже подключен этот тариф.' },
        { status: 400 }
      )
    }

    const newPrice = newPlan.price ?? 0
    if (newPrice <= 0) {
      return NextResponse.json(
        { error: 'Переход на бесплатный тариф оформите через выбор тарифа и оплату.' },
        { status: 400 }
      )
    }

    const now = new Date()
    const proration = calculateProratedPeriodEnd(
      now,
      subscription.currentPeriodEnd,
      oldPrice,
      newPrice,
      30
    )

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        planId: newPlan.id,
        currentPeriodEnd: proration.newPeriodEnd,
      },
      include: { plan: true },
    })

    return NextResponse.json({
      success: true,
      message: 'Тариф изменён. Подписка пересчитана по остатку.',
      subscription: {
        id: updated.id,
        status: updated.status,
        planId: updated.planId,
        plan: updated.plan,
        currentPeriodEnd: updated.currentPeriodEnd?.toISOString() ?? null,
      },
    })
  } catch (error) {
    console.error('[billing][change-plan][POST]', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to change plan' },
      { status: 500 }
    )
  }
}
