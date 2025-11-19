'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function BillingSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invoiceId = searchParams.get('invoiceId')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
          <div className="text-5xl">❌</div>
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--background-soft)] via-white to-[var(--primary-soft)] px-4">
      <div className="glass-panel rounded-3xl p-8 max-w-md w-full text-center space-y-4">
        <div className="text-5xl">✅</div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Оплата успешна!</h1>
          <p className="text-[var(--muted)]">
            Ваша подписка активирована. Вы можете начать использовать все возможности выбранного тарифа.
          </p>
        </div>
        <div className="space-y-3">
          <Link
            href="/company"
            className="btn-primary block w-full text-center"
          >
            Перейти к настройкам компании
          </Link>
          <Link
            href="/"
            className="btn-secondary block w-full text-center"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  )
}

