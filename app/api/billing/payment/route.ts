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

  // В режиме разработки пропускаем проверку конфигурации YooKassa
  // Используем DEV_MODE для явного включения режима разработки (работает и в Vercel)
  const isDevMode = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development'
  
  if (!isDevMode && !isYooKassaConfigured()) {
    return NextResponse.json(
      { error: 'Payment system not configured' },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()
    const { planId, billingInterval = 'MONTHLY', months = 1, amount, paymentType = 'individual' } = body as {
      planId?: number
      billingInterval?: 'MONTHLY' | 'YEARLY'
      months?: number
      amount?: number
      paymentType?: 'individual' | 'legal'
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

    // Рассчитываем итоговую сумму с учетом скидок
    const finalAmount = amount || plan.price * months
    const calculatedMonths = months || (billingInterval === 'YEARLY' ? 12 : 1)

    // В режиме разработки или если план бесплатный, сразу активируем подписку
    const isDevMode = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development'
    if (plan.price === 0 || isDevMode) {
      const now = new Date()
      const nextPeriod = new Date(now)
      nextPeriod.setMonth(nextPeriod.getMonth() + calculatedMonths)

      const subscription = await prisma.subscription.create({
        data: {
          companyId: Number(currentUser.companyId),
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          billingInterval: calculatedMonths >= 12 ? BillingInterval.YEARLY : BillingInterval.MONTHLY,
          currentPeriodEnd: nextPeriod,
        },
        include: {
          plan: true,
        },
      })

      // В режиме разработки также создаем счет как оплаченный
      if (isDevMode && plan.price > 0) {
        await prisma.invoice.create({
          data: {
            subscriptionId: subscription.id,
            amount: finalAmount,
            currency: plan.currency,
            status: 'PAID',
            paidAt: new Date(),
          },
        })
      }

      return NextResponse.json({ subscription, paymentUrl: null })
    }

    // Создаем подписку со статусом TRIAL (будет активирована после оплаты)
    const now = new Date()
    const nextPeriod = new Date(now)
    nextPeriod.setMonth(nextPeriod.getMonth() + calculatedMonths)

    const subscription = await prisma.subscription.create({
      data: {
        companyId: Number(currentUser.companyId),
        planId: plan.id,
        status: SubscriptionStatus.TRIAL,
        billingInterval: calculatedMonths >= 12 ? BillingInterval.YEARLY : BillingInterval.MONTHLY,
        currentPeriodEnd: nextPeriod,
      },
    })

    // Получаем компанию для проверки типа
    const company = await prisma.company.findUnique({
      where: { id: Number(currentUser.companyId) },
    })

    // Если выбрано юр лицо или компания является юр лицом, создаем счет без YooKassa
    const isLegalEntity = paymentType === 'legal' || company?.isLegalEntity

    // Создаем счет
    const invoice = await prisma.invoice.create({
      data: {
        subscriptionId: subscription.id,
        amount: finalAmount,
        currency: plan.currency,
        status: isLegalEntity ? 'PENDING' : 'PENDING',
      },
    })

    // Если юр лицо, возвращаем только invoiceId для генерации PDF
    if (isLegalEntity) {
      return NextResponse.json({
        invoiceId: invoice.id,
        paymentUrl: null,
        paymentId: null,
      })
    }

    // Для физ лиц создаем платеж в YooKassa
    const baseUrl = process.env.NEXTAUTH_URL || 'https://ai-crm-flame.vercel.app'
    const returnUrl = `${baseUrl}/billing/success?invoiceId=${invoice.id}`
    const cancelUrl = `${baseUrl}/billing/cancel?invoiceId=${invoice.id}`

    const periodLabel = calculatedMonths === 1 
      ? '1 месяц' 
      : calculatedMonths === 3 
      ? '3 месяца' 
      : calculatedMonths === 6 
      ? '6 месяцев' 
      : '1 год'

    const payment = await createYooKassaPayment(
      finalAmount,
      plan.currency,
      `Подписка ${plan.name} - ${periodLabel}`,
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

