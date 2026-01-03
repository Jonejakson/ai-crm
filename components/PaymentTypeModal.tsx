'use client'

import { createPortal } from 'react-dom'

interface PaymentTypeModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (type: 'individual' | 'legal') => void
  totalAmount: number
  periodLabel: string
}

export default function PaymentTypeModal({
  isOpen,
  onClose,
  onSelect,
  totalAmount,
  periodLabel,
}: PaymentTypeModalProps) {
  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-panel rounded-3xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Выберите тип плательщика</h2>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-[var(--muted)] mb-2">
          Период: <span className="font-semibold text-[var(--foreground)]">{periodLabel}</span>
        </p>
        <p className="text-lg font-semibold text-[var(--foreground)] mb-6">
          Сумма: {Math.round(totalAmount).toLocaleString('ru-RU')} ₽
        </p>

        <div className="space-y-3">
          <button
            onClick={() => onSelect('individual')}
            className="w-full text-left p-4 rounded-2xl border-2 border-[var(--border)] hover:border-[var(--primary)] transition-all hover:bg-[var(--primary-soft)]/10"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">Физическое лицо</h3>
                <p className="text-sm text-[var(--muted)]">Оплата через YooKassa (карта, СБП, электронные кошельки)</p>
              </div>
              <svg className="w-8 h-8 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
          </button>

          <button
            onClick={() => onSelect('legal')}
            className="w-full text-left p-4 rounded-2xl border-2 border-[var(--border)] hover:border-[var(--primary)] transition-all hover:bg-[var(--primary-soft)]/10"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">Юридическое лицо</h3>
                <p className="text-sm text-[var(--muted)]">Получение счета для оплаты по реквизитам</p>
              </div>
              <svg className="w-8 h-8 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

