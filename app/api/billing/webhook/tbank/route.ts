import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { SubscriptionStatus, InvoiceStatus } from '@prisma/client'
import { calculatePeriodEnd } from '@/lib/invoice-utils'

/**
 * Вебхук Т-Банка «Операция по счёту».
 * Подключение: openapi@tbank.ru, указать ИНН, вебхук «Операция по счёту», URL этого метода.
 * При поступлении денег Т-Банк шлёт POST с данными операции; мы ищем pending-счёт по сумме и назначению и подтверждаем оплату.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Т-Банк присылает уведомления с IP 212.233.80.7 и 91.218.132.2 (опционально можно проверять)
    // const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip')

    // Формат вебхука: может быть одна операция или массив operations (см. документацию T-API)
    const operations: Array<{
      operationId?: string
      credit?: number
      amount?: number
      payPurpose?: string
      description?: string
      purpose?: string
    }> = Array.isArray(body.operations) ? body.operations : body.operationId ? [body] : []

    if (operations.length === 0) {
      return NextResponse.json({ success: true, message: 'No operations' })
    }

    for (const op of operations) {
      // Только входящие: credit > 0 (в выписке Т-Банка credit — поступление)
      const amountKopecks = op.credit ?? op.amount ?? 0
      if (amountKopecks <= 0) continue

      const amountRub = amountKopecks >= 100 ? amountKopecks / 100 : amountKopecks
      const purpose = [op.payPurpose, op.description, op.purpose].filter(Boolean).join(' ') || ''

      // Ищем pending-счета: по сумме (в БД amount в рублях, Int)
      const amountMatch = Math.round(amountRub)
      const pendingInvoices = await prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.PENDING,
          amount: amountMatch,
        },
        include: {
          subscription: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      if (pendingInvoices.length === 0) continue

      // Если в назначении есть номер счёта — берём точное совпадение
      let invoice = pendingInvoices.find((inv) => inv.invoiceNumber && purpose.includes(inv.invoiceNumber))
      if (!invoice) invoice = pendingInvoices[0]

      const now = new Date()
      const paymentPeriodMonths = invoice.paymentPeriodMonths || 1
      const baseDate =
        invoice.subscription.currentPeriodEnd && invoice.subscription.currentPeriodEnd > now
          ? invoice.subscription.currentPeriodEnd
          : now
      const periodEnd = calculatePeriodEnd(baseDate, paymentPeriodMonths)

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.PAID,
          paidAt: now,
        },
      })

      await prisma.subscription.update({
        where: { id: invoice.subscriptionId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: periodEnd,
        },
      })

      // Один платёж — один счёт
      break
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[billing][webhook][tbank]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process webhook' },
      { status: 500 }
    )
  }
}
