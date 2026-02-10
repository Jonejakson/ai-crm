import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'
import { createYooKassaPayment, isYooKassaConfigured } from '@/lib/payment'
import { SubscriptionStatus, BillingInterval, PayerType } from '@prisma/client'
import { calculatePaymentAmount, calculatePeriodEnd } from '@/lib/invoice-utils'

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
    const { planId, paymentPeriodMonths = 1, billingInterval, paymentMethodType } = body as {
      planId?: number
      paymentPeriodMonths?: 1 | 3 | 6 | 12 // Новое поле для периода оплаты
      billingInterval?: 'MONTHLY' | 'YEARLY' // Устаревшее, оставлено для совместимости
      paymentMethodType?: 'sbp'
    }

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 })
    }

    // Валидация периода оплаты
    if (![1, 3, 6, 12].includes(paymentPeriodMonths)) {
      return NextResponse.json(
        { error: 'Payment period must be 1, 3, 6, or 12 months' },
        { status: 400 }
      )
    }

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Получаем информацию о компании
    const company = await prisma.company.findUnique({
      where: { id: Number(currentUser.companyId) },
      select: { id: true, isLegalEntity: true, name: true, inn: true },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Определяем тип плательщика
    const payerType = company.isLegalEntity ? PayerType.LEGAL : PayerType.INDIVIDUAL

    // Рассчитываем сумму платежа
    const paymentAmount = calculatePaymentAmount(plan.price, paymentPeriodMonths)

    // В режиме разработки или если план бесплатный, сразу активируем подписку
    const isDevMode = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development'
    if (plan.price === 0 || isDevMode) {
      const now = new Date()
      const nextPeriod = calculatePeriodEnd(now, paymentPeriodMonths)

      const subscription = await prisma.subscription.create({
        data: {
          companyId: Number(currentUser.companyId),
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          billingInterval: BillingInterval.MONTHLY, // Используем MONTHLY для всех периодов
          currentPeriodEnd: nextPeriod,
        },
        include: {
          plan: true,
        },
      })

      return NextResponse.json({ subscription, paymentUrl: null })
    }

    // ВАЖНО: "Счёт" (Invoice) НЕ создаём тут никогда.
    // Инвойсы должны генерироваться/сохраняться ТОЛЬКО при выборе способа оплаты "Счёт"
    // через /api/billing/invoice/generate.
    //
    // Если у компании уже есть активная подписка — продлеваем её (не создаём новую).
    // Иначе создаём временную подписку; при отмене платежа она будет удалена в webhook.

    const now = new Date()
    const existingActive = await prisma.subscription.findFirst({
      where: {
        companyId: Number(currentUser.companyId),
        status: SubscriptionStatus.ACTIVE,
        planId: plan.id,
        OR: [
          { currentPeriodEnd: null },
          { currentPeriodEnd: { gt: now } },
        ],
      },
      orderBy: { currentPeriodEnd: 'desc' },
    })

    let subscription: { id: number; companyId: number; planId: number; status: string; billingInterval: string; currentPeriodEnd: Date | null }
    if (existingActive) {
      subscription = existingActive
    } else {
      subscription = await prisma.subscription.create({
        data: {
          companyId: Number(currentUser.companyId),
          planId: plan.id,
          status: SubscriptionStatus.TRIAL,
          billingInterval: BillingInterval.MONTHLY,
          currentPeriodEnd: null,
        },
      })
    }

    // Создаем платеж в YooKassa
    const baseUrl = process.env.NEXTAUTH_URL || 'https://flamecrm.ru'
    // Требование: при отмене оплаты пользователь просто возвращается в меню компании.
    // YooKassa использует return_url для возврата в браузер — используем /company.
    const returnUrl = `${baseUrl}/company`

    const periodLabel = paymentPeriodMonths === 1 
      ? '1 месяц' 
      : paymentPeriodMonths === 3 
      ? '3 месяца' 
      : paymentPeriodMonths === 6 
      ? '6 месяцев' 
      : '12 месяцев'

    const payment = await createYooKassaPayment(
      paymentAmount,
      plan.currency,
      `Подписка ${plan.name} - ${periodLabel}`,
      returnUrl,
      {
        subscriptionId: subscription.id.toString(),
        companyId: currentUser.companyId,
        planId: plan.id.toString(),
        paymentPeriodMonths: paymentPeriodMonths.toString(),
        payerType: payerType.toString(),
      },
      paymentMethodType ? { paymentMethodType } : undefined
    )

    // Сохраняем ID платежа в подписке
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { externalSubscriptionId: payment.id },
    })

    return NextResponse.json({
      paymentUrl: payment.confirmation?.confirmation_url || null,
      paymentId: payment.id,
      amount: paymentAmount,
      paymentPeriodMonths,
      subscriptionId: subscription.id,
    })
  } catch (error: any) {
    console.error('[billing][payment][POST]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create payment' },
      { status: 500 }
    )
  }
}

