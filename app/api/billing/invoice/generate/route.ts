import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'
import { SubscriptionStatus, BillingInterval, PayerType } from '@prisma/client'
import { generateInvoiceNumber, calculatePaymentAmount, calculatePeriodEnd } from '@/lib/invoice-utils'

/**
 * Генерация счета для юридических лиц
 */
export async function POST(request: Request) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { planId, paymentPeriodMonths = 1 } = body as {
      planId?: number
      paymentPeriodMonths?: 1 | 3 | 6 | 12
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
      select: { id: true, name: true, inn: true, isLegalEntity: true },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Проверяем, что компания - юридическое лицо
    if (!company.isLegalEntity) {
      return NextResponse.json(
        { error: 'This endpoint is only for legal entities. Use /api/billing/payment for individuals' },
        { status: 400 }
      )
    }

    // Рассчитываем сумму платежа
    const paymentAmount = calculatePaymentAmount(plan.price, paymentPeriodMonths)

    // Создаем подписку со статусом TRIAL (будет активирована после оплаты)
    const now = new Date()
    const nextPeriod = calculatePeriodEnd(now, paymentPeriodMonths)

    const subscription = await prisma.subscription.create({
      data: {
        companyId: company.id,
        planId: plan.id,
        status: SubscriptionStatus.TRIAL,
        billingInterval: BillingInterval.MONTHLY,
        currentPeriodEnd: nextPeriod,
      },
      include: {
        plan: true,
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
        payerType: PayerType.LEGAL,
        amount: paymentAmount,
        currency: plan.currency,
        status: 'PENDING',
      },
    })

    // Формируем URL для скачивания PDF (будет создан отдельный endpoint)
    const baseUrl = process.env.NEXTAUTH_URL || 'https://flamecrm.ru'
    const pdfUrl = `${baseUrl}/api/billing/invoice/${invoice.id}/pdf`

    return NextResponse.json({
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: paymentAmount,
        currency: plan.currency,
        paymentPeriodMonths,
        companyId: company.id,
        companyName: company.name,
        companyInn: company.inn,
        createdAt: invoice.createdAt.toISOString(),
      },
      subscription: {
        id: subscription.id,
        plan: subscription.plan.name,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || null,
      },
      pdfUrl,
    })
  } catch (error: any) {
    console.error('[billing][invoice][generate][POST]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate invoice' },
      { status: 500 }
    )
  }
}
