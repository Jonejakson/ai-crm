import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'
import { json } from '@/lib/json-response'
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
    return json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Только owner может продлевать подписки
  if (currentUser.role !== 'owner') {
    return json({ error: 'Forbidden: Owner only' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { companyId, paymentPeriodMonths = 1, confirmPaid } = body as {
      companyId?: number
      paymentPeriodMonths?: 1 | 3 | 6 | 12
      confirmPaid?: boolean
    }

    if (!companyId) {
      return json({ error: 'Company ID is required' }, { status: 400 })
    }

    // Валидация периода оплаты
    if (![1, 3, 6, 12].includes(paymentPeriodMonths)) {
      return json(
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
      return json({ error: 'Company not found' }, { status: 404 })
    }

    // Находим подписку: для confirmPaid — любая (ACTIVE или TRIAL), иначе только ACTIVE.
    // Важно: берём подписку с максимальной датой окончания (currentPeriodEnd), чтобы не затереть
    // продления, сделанные через СБП/ЮKassa — и добавлять новый период к этой дате.
    const candidates = await prisma.subscription.findMany({
      where: {
        companyId: company.id,
        ...(confirmPaid
          ? { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] } }
          : { status: SubscriptionStatus.ACTIVE }),
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    })

    const activeSubscription = candidates.length === 0
      ? null
      : candidates.reduce((best, sub) => {
          const bestEnd = best.currentPeriodEnd?.getTime() ?? 0
          const subEnd = sub.currentPeriodEnd?.getTime() ?? 0
          return subEnd >= bestEnd ? sub : best
        })

    if (!activeSubscription) {
      return json(
        { error: 'Subscription not found for this company' },
        { status: 404 }
      )
    }

    // Режим «оплата получена»: только продлить срок без счёта и ЮKassa.
    // baseDate = текущая дата окончания подписки (если в будущем), иначе сегодня — чтобы не списывать продления по СБП.
    if (confirmPaid) {
      const now = new Date()
      const baseDate =
        activeSubscription.currentPeriodEnd && activeSubscription.currentPeriodEnd > now
          ? activeSubscription.currentPeriodEnd
          : now
      const periodEnd = calculatePeriodEnd(baseDate, paymentPeriodMonths)

      await prisma.subscription.update({
        where: { id: activeSubscription.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: periodEnd,
          trialEndsAt: null,
        },
      })

      return json({
        success: true,
        message: 'Подписка продлена',
        subscription: {
          id: activeSubscription.id,
          currentPeriodEnd: periodEnd.toISOString(),
          plan: activeSubscription.plan.name,
        },
      })
    }

    const plan = activeSubscription.plan
    const paymentAmount = calculatePaymentAmount(plan.price, paymentPeriodMonths)
    const payerType = company.isLegalEntity ? PayerType.LEGAL : PayerType.INDIVIDUAL

    // Подписку НЕ продлеваем до подтверждения оплаты.
    // Продление делается в webhook (для YooKassa) или вручную (для счетов юрлиц).

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
        return json(
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

    return json({
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
        id: activeSubscription.id,
        currentPeriodEnd: activeSubscription.currentPeriodEnd?.toISOString() || null,
        plan: activeSubscription.plan.name,
      },
      paymentUrl, // null для юр лиц, URL для физ лиц
      pdfUrl: payerType === PayerType.LEGAL 
        ? `${process.env.NEXTAUTH_URL || 'https://flamecrm.ru'}/api/billing/invoice/${invoice.id}/pdf`
        : null,
    })
  } catch (error: any) {
    console.error('[admin][extend-subscription][POST]', error)
    return json(
      { error: error.message || 'Failed to extend subscription' },
      { status: 500 }
    )
  }
}
