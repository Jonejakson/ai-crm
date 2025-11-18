import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'
import { createYooKassaPayment, isYooKassaConfigured } from '@/lib/payment'
import { SubscriptionStatus, BillingInterval } from '@prisma/client'

/**
 * Создать платеж для подписки
 */
export async function POST(request: Request) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isYooKassaConfigured()) {
    return NextResponse.json(
      { error: 'Payment system not configured' },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()
    const { planId, billingInterval = 'MONTHLY' } = body as {
      planId?: number
      billingInterval?: 'MONTHLY' | 'YEARLY'
    }

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 })
    }

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Если план бесплатный, сразу активируем подписку
    if (plan.price === 0) {
      const now = new Date()
      const nextPeriod = new Date(now)
      if (billingInterval === 'YEARLY') {
        nextPeriod.setFullYear(nextPeriod.getFullYear() + 1)
      } else {
        nextPeriod.setMonth(nextPeriod.getMonth() + 1)
      }

      const subscription = await prisma.subscription.create({
        data: {
          companyId: Number(currentUser.companyId),
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          billingInterval: billingInterval === 'YEARLY' ? BillingInterval.YEARLY : BillingInterval.MONTHLY,
          currentPeriodEnd: nextPeriod,
        },
        include: {
          plan: true,
        },
      })

      return NextResponse.json({ subscription, paymentUrl: null })
    }

    // Создаем подписку со статусом TRIAL (будет активирована после оплаты)
    const now = new Date()
    const nextPeriod = new Date(now)
    if (billingInterval === 'YEARLY') {
      nextPeriod.setFullYear(nextPeriod.getFullYear() + 1)
    } else {
      nextPeriod.setMonth(nextPeriod.getMonth() + 1)
    }

    const subscription = await prisma.subscription.create({
      data: {
        companyId: Number(currentUser.companyId),
        planId: plan.id,
        status: SubscriptionStatus.TRIAL,
        billingInterval: billingInterval === 'YEARLY' ? BillingInterval.YEARLY : BillingInterval.MONTHLY,
        currentPeriodEnd: nextPeriod,
      },
    })

    // Создаем счет
    const invoice = await prisma.invoice.create({
      data: {
        subscriptionId: subscription.id,
        amount: plan.price,
        currency: plan.currency,
        status: 'PENDING',
      },
    })

    // Создаем платеж в YooKassa
    const baseUrl = process.env.NEXTAUTH_URL || 'https://ai-crm-flame.vercel.app'
    const returnUrl = `${baseUrl}/billing/success?invoiceId=${invoice.id}`
    const cancelUrl = `${baseUrl}/billing/cancel?invoiceId=${invoice.id}`

    const payment = await createYooKassaPayment(
      plan.price,
      plan.currency,
      `Подписка ${plan.name} - ${billingInterval === 'YEARLY' ? 'Годовая' : 'Месячная'}`,
      returnUrl,
      {
        invoiceId: invoice.id.toString(),
        subscriptionId: subscription.id.toString(),
        companyId: currentUser.companyId,
      }
    )

    // Сохраняем ID платежа в счете
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { externalId: payment.id },
    })

    // Сохраняем ID платежа в подписке
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { externalSubscriptionId: payment.id },
    })

    return NextResponse.json({
      paymentUrl: payment.confirmation?.confirmation_url || null,
      paymentId: payment.id,
      invoiceId: invoice.id,
    })
  } catch (error: any) {
    console.error('[billing][payment][POST]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create payment' },
      { status: 500 }
    )
  }
}

