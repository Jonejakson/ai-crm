import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'
import { SubscriptionStatus, BillingInterval, PayerType } from '@prisma/client'
import { generateInvoiceNumber, calculatePaymentAmount, calculatePeriodEnd } from '@/lib/invoice-utils'
import { createYooKassaPayment, isYooKassaConfigured } from '@/lib/payment'

/**
 * Продление подписки админом (owner)
 * Доступ: только для owner
 */
export async function POST(request: Request) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Только owner может продлевать подписки
  if (currentUser.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden: Owner only' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { companyId, paymentPeriodMonths = 1 } = body as {
      companyId?: number
      paymentPeriodMonths?: 1 | 3 | 6 | 12
    }

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    // Валидация периода оплаты
    if (![1, 3, 6, 12].includes(paymentPeriodMonths)) {
      return NextResponse.json(
        { error: 'Payment period must be 1, 3, 6, or 12 months' },
        { status: 400 }
      )
    }

    // Получаем информацию о компании
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, inn: true, isLegalEntity: true },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Находим активную подписку компании
    const ACTIVE_STATUSES = [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL]
    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        companyId: company.id,
        status: { in: ACTIVE_STATUSES },
      },
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (!activeSubscription) {
      return NextResponse.json(
        { error: 'Active subscription not found for this company' },
        { status: 404 }
      )
    }

    const plan = activeSubscription.plan
    const paymentAmount = calculatePaymentAmount(plan.price, paymentPeriodMonths)
    const payerType = company.isLegalEntity ? PayerType.LEGAL : PayerType.INDIVIDUAL

    // Вычисляем новую дату окончания
    const currentPeriodEnd = activeSubscription.currentPeriodEnd || new Date()
    const newPeriodEnd = calculatePeriodEnd(currentPeriodEnd, paymentPeriodMonths)

    // Обновляем подписку: продлеваем период
    const updatedSubscription = await prisma.subscription.update({
      where: { id: activeSubscription.id },
      data: {
        currentPeriodEnd: newPeriodEnd,
        status: SubscriptionStatus.ACTIVE, // Убеждаемся, что статус ACTIVE
      },
      include: {
        plan: true,
      },
    })

    // Создаем счет для продления
    const invoiceNumber = await generateInvoiceNumber()
    const invoice = await prisma.invoice.create({
      data: {
        subscriptionId: activeSubscription.id,
        invoiceNumber,
        paymentPeriodMonths,
        companyId: company.id,
        payerType,
        amount: paymentAmount,
        currency: plan.currency,
        status: 'PENDING',
      },
    })

    let paymentUrl: string | null = null

    // Для физических лиц создаем платеж в YooKassa
    if (payerType === PayerType.INDIVIDUAL) {
      const isDevMode = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development'
      
      if (!isDevMode && !isYooKassaConfigured()) {
        return NextResponse.json(
          { error: 'Payment system not configured' },
          { status: 500 }
        )
      }

      const baseUrl = process.env.NEXTAUTH_URL || 'https://flamecrm.ru'
      const returnUrl = `${baseUrl}/billing/success?invoiceId=${invoice.id}`

      const periodLabel = paymentPeriodMonths === 1
        ? '1 месяц'
        : paymentPeriodMonths === 3
        ? '3 месяца'
        : paymentPeriodMonths === 6
        ? '6 месяцев'
        : '12 месяцев'

      try {
        const payment = await createYooKassaPayment(
          paymentAmount,
          plan.currency,
          `Продление подписки ${plan.name} - ${periodLabel}`,
          returnUrl,
          {
            invoiceId: invoice.id.toString(),
            subscriptionId: activeSubscription.id.toString(),
            companyId: company.id.toString(),
          }
        )

        paymentUrl = payment.confirmation?.confirmation_url || null

        // Сохраняем ID платежа
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { externalId: payment.id },
        })
      } catch (error: any) {
        console.error('[admin][extend-subscription] YooKassa error:', error)
        // Продолжаем без paymentUrl для юр лиц или при ошибке
      }
    }

    return NextResponse.json({
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: paymentAmount,
        paymentPeriodMonths,
        companyId: company.id,
        companyName: company.name,
        companyInn: company.inn,
        payerType: payerType,
      },
      subscription: {
        id: updatedSubscription.id,
        currentPeriodEnd: updatedSubscription.currentPeriodEnd?.toISOString() || null,
        plan: updatedSubscription.plan.name,
      },
      paymentUrl, // null для юр лиц, URL для физ лиц
      pdfUrl: payerType === PayerType.LEGAL 
        ? `${process.env.NEXTAUTH_URL || 'https://flamecrm.ru'}/api/billing/invoice/${invoice.id}/pdf`
        : null,
    })
  } catch (error: any) {
    console.error('[admin][extend-subscription][POST]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to extend subscription' },
      { status: 500 }
    )
  }
}
