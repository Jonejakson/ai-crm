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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Проверка статуса платежа...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Ошибка</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link
              href="/company"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Вернуться к настройкам
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="text-green-500 text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Оплата успешна!</h1>
          <p className="text-gray-600 mb-6">
            Ваша подписка активирована. Вы можете начать использовать все возможности вашего тарифа.
          </p>
          <div className="space-y-3">
            <Link
              href="/company"
              className="block w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Перейти к настройкам компании
            </Link>
            <Link
              href="/"
              className="block w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors"
            >
              На главную
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

