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

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DEFAULT_DAYS_IN_MONTH = 30

export interface ProrationResult {
  /** Остаток дней до конца текущего периода (дробное) */
  remainingDays: number
  /** Денежный остаток (неиспользованная часть подписки по старому тарифу) */
  credit: number
  /** Сколько дней по новому тарифу покрывает остаток */
  daysAtNewRate: number
  /** Новая дата окончания подписки после пересчёта */
  newPeriodEnd: Date
}

/**
 * Перерасчёт подписки при смене тарифа: месяц = 30 дней.
 * Остаток по старому тарифу (цена/30 * остаток_дней) переводится в дни по новому тарифу (цена/30 за день).
 */
export function calculateProratedPeriodEnd(
  now: Date,
  currentPeriodEnd: Date,
  oldPricePerMonth: number,
  newPricePerMonth: number,
  daysInMonth: number = DEFAULT_DAYS_IN_MONTH
): ProrationResult {
  const endMs = currentPeriodEnd.getTime()
  const nowMs = now.getTime()
  const remainingMs = Math.max(0, endMs - nowMs)
  const remainingDays = remainingMs / MS_PER_DAY

  const credit = (oldPricePerMonth / daysInMonth) * remainingDays
  const newPricePerDay = newPricePerMonth / daysInMonth
  const daysAtNewRate = newPricePerDay > 0 ? credit / newPricePerDay : 0
  const newPeriodEnd = new Date(nowMs + daysAtNewRate * MS_PER_DAY)

  return {
    remainingDays,
    credit,
    daysAtNewRate,
    newPeriodEnd,
  }
}
