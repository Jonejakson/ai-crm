'use client'

import { createPortal } from 'react-dom'

interface PaymentPeriodModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (period: PaymentPeriod) => void
  monthlyPrice: number
  planName: string
}

export type PaymentPeriod = '1' | '3' | '6' | '12'

interface PeriodOption {
  value: PaymentPeriod
  label: string
  months: number
  discount: number
}

const PERIODS: PeriodOption[] = [
  { value: '1', label: '1 месяц', months: 1, discount: 0 },
  { value: '3', label: '3 месяца', months: 3, discount: 5 },
  { value: '6', label: '6 месяцев', months: 6, discount: 10 },
  { value: '12', label: '1 год', months: 12, discount: 20 },
]

export default function PaymentPeriodModal({
  isOpen,
  onClose,
  onSelect,
  monthlyPrice,
  planName,
}: PaymentPeriodModalProps) {
  if (!isOpen) return null

  const calculatePrice = (months: number, discount: number) => {
    const total = monthlyPrice * months
    const discountAmount = (total * discount) / 100
    return {
      total,
      discountAmount,
      final: total - discountAmount,
      monthly: (total - discountAmount) / months,
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-panel rounded-3xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Выберите период оплаты</h2>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-[var(--muted)] mb-6">
          План: <span className="font-semibold text-[var(--foreground)]">{planName}</span>
        </p>

        <div className="space-y-3">
          {PERIODS.map((period) => {
            const { total, discountAmount, final, monthly } = calculatePrice(period.months, period.discount)

            return (
              <button
                key={period.value}
                onClick={() => onSelect(period.value)}
                className="w-full text-left p-4 rounded-2xl border-2 border-[var(--border)] hover:border-[var(--primary)] transition-all hover:bg-[var(--primary-soft)]/10"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold text-[var(--foreground)]">{period.label}</span>
                    {period.discount > 0 && (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-1 text-xs font-semibold border border-emerald-100">
                        Скидка {period.discount}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[var(--foreground)]">
                    {Math.round(final).toLocaleString('ru-RU')} ₽
                  </span>
                  {period.discount > 0 && (
                    <span className="text-sm text-[var(--muted)] line-through">
                      {Math.round(total).toLocaleString('ru-RU')} ₽
                    </span>
                  )}
                </div>
                {period.months > 1 && (
                  <p className="text-xs text-[var(--muted)] mt-1">
                    {Math.round(monthly).toLocaleString('ru-RU')} ₽ в месяц
                  </p>
                )}
                {period.discount > 0 && (
                  <p className="text-xs text-emerald-600 mt-1">
                    Экономия: {Math.round(discountAmount).toLocaleString('ru-RU')} ₽
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}


