import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'
import { createYooKassaPayment, isYooKassaConfigured } from '@/lib/payment'
import { SubscriptionStatus, BillingInterval, PayerType } from '@prisma/client'
import { generateInvoiceNumber, calculatePaymentAmount, calculatePeriodEnd } from '@/lib/invoice-utils'

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
    const { planId, paymentPeriodMonths = 1, billingInterval } = body as {
      planId?: number
      paymentPeriodMonths?: 1 | 3 | 6 | 12 // Новое поле для периода оплаты
      billingInterval?: 'MONTHLY' | 'YEARLY' // Устаревшее, оставлено для совместимости
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

      // В режиме разработки также создаем счет как оплаченный
      if (isDevMode && plan.price > 0) {
        const invoiceNumber = await generateInvoiceNumber()
        await prisma.invoice.create({
          data: {
            subscriptionId: subscription.id,
            invoiceNumber,
            paymentPeriodMonths,
            companyId: company.id,
            payerType,
            amount: paymentAmount,
            currency: plan.currency,
            status: 'PAID',
            paidAt: new Date(),
          },
        })
      }

      return NextResponse.json({ subscription, paymentUrl: null })
    }

    // Для юридических лиц тоже разрешаем оплату через YooKassa (если выбрано в UI).
    // Альтернативный путь для юрлиц — выставление счета через /api/billing/invoice/generate.

    // Создаем подписку со статусом TRIAL (будет активирована после оплаты)
    const now = new Date()
    const nextPeriod = calculatePeriodEnd(now, paymentPeriodMonths)

    const subscription = await prisma.subscription.create({
      data: {
        companyId: Number(currentUser.companyId),
        planId: plan.id,
        status: SubscriptionStatus.TRIAL,
        billingInterval: BillingInterval.MONTHLY, // Используем MONTHLY для всех периодов
        currentPeriodEnd: nextPeriod,
      },
    })

    // Генерируем номер счета и создаем счет
    const invoiceNumber = await generateInvoiceNumber()
    const invoice = await prisma.invoice.create({
      data: {
        subscriptionId: subscription.id,
        invoiceNumber,
        paymentPeriodMonths,
        companyId: company.id,
        payerType,
        amount: paymentAmount,
        currency: plan.currency,
        status: 'PENDING',
      },
    })

    // Создаем платеж в YooKassa
    const baseUrl = process.env.NEXTAUTH_URL || 'https://flamecrm.ru'
    const returnUrl = `${baseUrl}/billing/success?invoiceId=${invoice.id}`
    // cancelUrl пока не используется (но можно добавить страницу /billing/cancel при необходимости)

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
      invoiceNumber: invoice.invoiceNumber,
      amount: paymentAmount,
      paymentPeriodMonths,
    })
  } catch (error: any) {
    console.error('[billing][payment][POST]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create payment' },
      { status: 500 }
    )
  }
}

