'use client'

import { useState } from 'react'
import Modal from './Modal'

interface ExtendSubscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  companyId: number
  companyName: string
  onSuccess?: () => void
}

const PERIOD_OPTIONS = [
  { value: 1, label: '1 месяц' },
  { value: 3, label: '3 месяца' },
  { value: 6, label: '6 месяцев' },
  { value: 12, label: '12 месяцев' },
] as const

export default function ExtendSubscriptionModal({
  isOpen,
  onClose,
  companyId,
  companyName,
  onSuccess,
}: ExtendSubscriptionModalProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<1 | 3 | 6 | 12>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExtend = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/extend-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId,
          paymentPeriodMonths: selectedPeriod,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Не удалось продлить подписку')
      }

      // Если есть paymentUrl (для физ лиц), перенаправляем на оплату
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl
        return
      }

      // Если есть pdfUrl (для юр лиц), показываем сообщение
      if (data.pdfUrl) {
        alert(`Счет для компании "${companyName}" создан. Номер счета: ${data.invoice.invoiceNumber}. Скачать можно по ссылке: ${data.pdfUrl}`)
      }

      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при продлении подписки')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Продлить подписку"
      size="md"
    >
      <div className="p-6 space-y-6">
        {/* Информация о компании */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
          <div className="text-sm text-[var(--muted)] mb-1">Компания</div>
          <div className="text-lg font-semibold text-[var(--foreground)]">{companyName}</div>
          <div className="text-xs text-[var(--muted)] mt-1">ID: {companyId}</div>
        </div>

        {/* Выбор периода */}
        <div>
          <label className="block text-sm font-semibold text-[var(--foreground)] mb-3">
            Период продления:
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

        {/* Ошибка */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

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
            onClick={handleExtend}
            disabled={loading}
            className="btn-primary px-4 py-2"
          >
            {loading ? 'Обработка...' : 'Продлить подписку'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
