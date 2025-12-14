'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ErrorIcon, SuccessIcon } from '@/components/Icons'

interface InvoiceInfo {
  id?: string
  status?: string
  amount?: number
  currency?: string
  planName?: string
  createdAt?: string
}

export default function BillingSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invoiceId = searchParams.get('invoiceId')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [invoiceInfo, setInvoiceInfo] = useState<InvoiceInfo | null>(null)

  useEffect(() => {
    if (!invoiceId) {
      setError('Invoice ID not provided')
      setLoading(false)
      return
    }

    // Проверяем статус платежа
    const checkPayment = async () => {
      try {
        const response = await fetch(`/api/billing/invoice/${invoiceId}`)
        if (!response.ok) {
          throw new Error('Failed to check invoice status')
        }
        const data = await response.json()

        if (data.invoice) {
          setInvoiceInfo({
            id: data.invoice.id ?? data.invoice.externalId ?? invoiceId ?? undefined,
            status: data.invoice.status,
            amount: data.invoice.amount,
            currency: data.invoice.currency,
            planName: data.invoice.metadata?.planName || data.invoice.plan?.name,
            createdAt: data.invoice.createdAt,
          })
        }

        if (data.invoice?.status === 'PAID') {
          setLoading(false)
        } else {
          // Если платеж еще не обработан, ждем немного и проверяем снова
          setTimeout(() => {
            checkPayment()
          }, 2000)
        }
      } catch (error: any) {
        console.error('Error checking payment:', error)
        setError('Ошибка при проверке статуса платежа')
        setLoading(false)
      }
    }

    checkPayment()
  }, [invoiceId])

  const formatCurrency = (amount?: number, currency?: string) => {
    if (!amount || amount <= 0) return '—'
    try {
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: currency || 'RUB',
        minimumFractionDigits: 0,
      }).format(amount / 100)
    } catch {
      return `${(amount / 100).toLocaleString('ru-RU')} ${currency || '₽'}`
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--background-soft)] to-white">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4" />
          <p className="text-[var(--muted)]">Проверка статуса платежа...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--background-soft)] to-white px-4">
        <div className="glass-panel rounded-3xl p-8 max-w-md w-full text-center space-y-4">
          <div>
            <ErrorIcon className="w-16 h-16 text-[var(--error)]" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Ошибка</h1>
            <p className="text-[var(--muted)]">{error}</p>
          </div>
          <Link
            href="/company"
            className="btn-primary inline-flex justify-center w-full"
          >
            Вернуться к настройкам
          </Link>
        </div>
      </div>
    )
  }

  const infoChips = [
    { label: 'План', value: invoiceInfo?.planName ?? 'Flame CRM' },
    { label: 'Сумма', value: formatCurrency(invoiceInfo?.amount, invoiceInfo?.currency) },
    { label: 'Invoice ID', value: invoiceInfo?.id ?? invoiceId ?? '—' },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--background-soft)] via-white to-[var(--primary-soft)] px-4 py-10">
      <div className="glass-panel rounded-3xl p-8 max-w-2xl w-full space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-4xl">
              <span>🎉</span>
              <SuccessIcon className="w-5 h-5" />
            </div>
            <h1 className="text-3xl font-bold text-[var(--foreground)]">Оплата прошла успешно!</h1>
            <p className="text-[var(--muted)]">
              Подписка активирована, доступ к возможностям выбранного тарифа открыт мгновенно. Мы уже отправили чек на ваш email.
            </p>
          </div>
          <div className="text-sm text-[var(--muted)] text-right">
            <p className="uppercase tracking-[0.2em] text-xs">Дата платежа</p>
            <p className="text-lg font-semibold text-[var(--foreground)]">
              {invoiceInfo?.createdAt ? new Date(invoiceInfo.createdAt).toLocaleDateString('ru-RU') : 'Сегодня'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {infoChips.map((chip) => (
            <div key={chip.label} className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{chip.label}</p>
              <p className="text-lg font-semibold text-[var(--foreground)]">{chip.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-[var(--primary-soft)] bg-gradient-to-br from-white to-[var(--primary-soft)]/40 p-6 space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Если оплата отображается с задержкой, просто обновите страницу — синхронизация с биллингом может занять до пары минут.
            В случае повторяющейся ошибки свяжитесь с нашей поддержкой: <a href="mailto:support@pocketcrm.io" className="text-[var(--primary)] underline">support@pocketcrm.io</a>.
          </p>
          <div className="flex flex-col md:flex-row gap-3">
            <Link href="/company" className="btn-primary flex-1 text-center">
              Перейти в настройки компании
            </Link>
            <Link href="/" className="btn-secondary flex-1 text-center">
              Открыть главную
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

