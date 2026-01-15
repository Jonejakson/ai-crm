import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getYooKassaPayment, verifyYooKassaWebhook } from '@/lib/payment'
import { SubscriptionStatus, InvoiceStatus } from '@prisma/client'
import { calculatePeriodEnd } from '@/lib/invoice-utils'

/**
 * Webhook для обработки уведомлений от YooKassa
 */
export async function POST(request: Request) {
  try {
    const body = await request.text()
    // YooKassa/ЮMoney могут присылать подпись разными заголовками в разных окружениях.
    // Пробуем несколько вариантов, чтобы не зависеть от точного имени.
    const signature =
      request.headers.get('x-yookassa-signature') ||
      request.headers.get('x-yoomoney-signature') ||
      request.headers.get('x-yoomoney-signature-sha256') ||
      request.headers.get('x-content-signature') ||
      request.headers.get('content-signature') ||
      ''

    // Проверяем подпись (в production обязательно!)
    // В development тоже проверяем, если YOOKASSA_SECRET_KEY установлен
    const shouldVerify = process.env.NODE_ENV === 'production' || !!process.env.YOOKASSA_SECRET_KEY
    if (shouldVerify) {
      const isValid = verifyYooKassaWebhook(body, signature)
      if (!isValid) {
        console.error('[webhook] Invalid YooKassa signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const event = JSON.parse(body)

    // YooKassa отправляет события в формате:
    // { type: 'notification', event: 'payment.succeeded', object: { ... } }
    if (event.type === 'notification' && event.event === 'payment.succeeded') {
      const payment = event.object

      // Получаем счет по externalId
      const invoice = await prisma.invoice.findFirst({
        where: { externalId: payment.id },
        include: {
          subscription: {
            include: {
              plan: true,
            },
          },
        },
      })

      if (!invoice) {
        console.error('[webhook] Invoice not found for payment:', payment.id)
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
      }

      // Обновляем статус счета
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.PAID,
          paidAt: new Date(),
        },
      })

      // Активируем подписку и обновляем период окончания
      if (invoice.subscription) {
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
      }

      return NextResponse.json({ success: true })
    }

    // Обработка отмены платежа
    if (event.type === 'notification' && event.event === 'payment.canceled') {
      const payment = event.object

      const invoice = await prisma.invoice.findFirst({
        where: { externalId: payment.id },
      })

      if (invoice) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: InvoiceStatus.FAILED,
          },
        })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: true, message: 'Event not processed' })
  } catch (error: any) {
    console.error('[billing][webhook][POST]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process webhook' },
      { status: 500 }
    )
  }
}

