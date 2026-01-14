'use client'

import { useState } from 'react'
import Modal from './Modal'

interface PaymentPeriodModalProps {
  isOpen: boolean
  onClose: () => void
  planId: number
  planName: string
  onConfirm: (paymentPeriodMonths: 1 | 3 | 6 | 12, paymentMethod?: 'yookassa' | 'invoice') => void
  isLegalEntity?: boolean
}

const PERIOD_OPTIONS = [
  { value: 1, label: '1 месяц', discount: 0 },
  { value: 3, label: '3 месяца', discount: 0 },
  { value: 6, label: '6 месяцев', discount: 0 },
  { value: 12, label: '12 месяцев', discount: 0 },
] as const

export default function PaymentPeriodModal({
  isOpen,
  onClose,
  planId,
  planName,
  onConfirm,
  isLegalEntity = false,
}: PaymentPeriodModalProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<1 | 3 | 6 | 12>(1)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'yookassa' | 'invoice'>('yookassa')
  const [loading, setLoading] = useState(false)

  const handleConfirm = () => {
    if (isLegalEntity) {
      onConfirm(selectedPeriod, selectedPaymentMethod)
    } else {
      onConfirm(selectedPeriod)
    }
    setLoading(true)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isLegalEntity ? 'Сформировать счет' : 'Оплатить подписку'}
      size="md"
    >
      <div className="p-6 space-y-6">
        {/* Информация о тарифе */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
          <div className="text-sm text-[var(--muted)] mb-1">Тариф</div>
          <div className="text-lg font-semibold text-[var(--foreground)]">{planName}</div>
        </div>

        {/* Выбор способа оплаты для юридических лиц */}
        {isLegalEntity && (
          <div>
            <label className="block text-sm font-semibold text-[var(--foreground)] mb-3">
              Способ оплаты:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedPaymentMethod('yookassa')}
                disabled={loading}
                className={`
                  px-4 py-3 rounded-2xl border-2 transition-all
                  ${
                    selectedPaymentMethod === 'yookassa'
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] font-semibold'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--primary-soft)]'
                  }
                  ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                Оплатить через YooKassa
              </button>
              <button
                onClick={() => setSelectedPaymentMethod('invoice')}
                disabled={loading}
                className={`
                  px-4 py-3 rounded-2xl border-2 transition-all
                  ${
                    selectedPaymentMethod === 'invoice'
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] font-semibold'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--primary-soft)]'
                  }
                  ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                Сформировать счет
              </button>
            </div>
          </div>
        )}

        {/* Выбор периода */}
        <div>
          <label className="block text-sm font-semibold text-[var(--foreground)] mb-3">
            Период оплаты:
          </label>
          <div className="grid grid-cols-2 gap-3">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedPeriod(option.value)}
                disabled={loading}
                className={`
                  px-4 py-3 rounded-2xl border-2 transition-all
                  ${
                    selectedPeriod === option.value
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] font-semibold'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--primary-soft)]'
                  }
                  ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            disabled={loading}
            className="btn-secondary px-4 py-2"
          >
            Отмена
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="btn-primary px-4 py-2"
          >
            {loading
              ? 'Обработка...'
              : isLegalEntity
              ? selectedPaymentMethod === 'invoice'
                ? 'Сформировать счет'
                : 'Оплатить через YooKassa'
              : 'Оплатить'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
