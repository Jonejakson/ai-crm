import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'
import { SubscriptionStatus, InvoiceStatus } from '@prisma/client'
import { calculatePeriodEnd } from '@/lib/invoice-utils'

/**
 * Подтверждение оплаты счета (ручное для юридических лиц)
 * Доступ: только для owner
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Только owner может подтверждать оплату
  if (currentUser.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden: Owner only' }, { status: 403 })
  }

  try {
    const { id } = await params
    const invoice = await prisma.invoice.findUnique({
      where: { id: parseInt(id) },
      include: {
        subscription: {
          include: {
            plan: true,
            company: true,
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Проверяем, что счет в статусе PENDING
    if (invoice.status !== InvoiceStatus.PENDING) {
      return NextResponse.json(
        { error: `Invoice is already ${invoice.status}` },
        { status: 400 }
      )
    }

    // Обновляем счет
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
      },
    })

    // Активируем подписку и обновляем период окончания
    const now = new Date()
    const paymentPeriodMonths = invoice.paymentPeriodMonths || 1
    const periodEnd = calculatePeriodEnd(now, paymentPeriodMonths)

    await prisma.subscription.update({
      where: { id: invoice.subscriptionId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: periodEnd,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Payment confirmed and subscription activated',
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
      },
      subscription: {
        id: invoice.subscription.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: periodEnd,
      },
    })
  } catch (error: any) {
    console.error('[billing][invoice][confirm][POST]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to confirm payment' },
      { status: 500 }
    )
  }
}
