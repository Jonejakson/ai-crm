import prisma from './prisma'

/**
 * Генерирует уникальный номер счета в формате INV-YYYYMMDD-NNNN
 * где YYYYMMDD - дата создания, NNNN - порядковый номер за день
 */
export async function generateInvoiceNumber(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD
  const prefix = `INV-${today}-`

  // Находим последний счет за сегодня
  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      invoiceNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      invoiceNumber: 'desc',
    },
    select: {
      invoiceNumber: true,
    },
  })

  let sequenceNumber = 1

  if (lastInvoice?.invoiceNumber) {
    // Извлекаем номер из строки типа "INV-20250112-0001"
    const match = lastInvoice.invoiceNumber.match(/-(\d+)$/)
    if (match) {
      sequenceNumber = parseInt(match[1], 10) + 1
    }
  }

  // Форматируем номер с ведущими нулями (4 цифры)
  const formattedNumber = sequenceNumber.toString().padStart(4, '0')
  return `${prefix}${formattedNumber}`
}

/**
 * Вычисляет сумму платежа на основе цены плана и периода
 */
export function calculatePaymentAmount(
  planPrice: number,
  paymentPeriodMonths: number
): number {
  return planPrice * paymentPeriodMonths
}

/**
 * Вычисляет дату окончания периода подписки
 */
export function calculatePeriodEnd(
  startDate: Date,
  paymentPeriodMonths: number
): Date {
  const endDate = new Date(startDate)
  endDate.setMonth(endDate.getMonth() + paymentPeriodMonths)
  return endDate
}
