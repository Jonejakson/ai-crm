'use client'

import Link from 'next/link'

export default function BillingCancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="text-yellow-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Оплата отменена</h1>
          <p className="text-gray-600 mb-6">
            Оплата была отменена. Ваша подписка не была активирована.
            Вы можете попробовать снова или выбрать другой тариф.
          </p>
          <div className="space-y-3">
            <Link
              href="/company"
              className="block w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Вернуться к выбору тарифа
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

