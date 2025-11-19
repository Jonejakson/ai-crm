'use client'

import Link from 'next/link'

export default function BillingCancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--background-soft)] via-white to-[var(--warning-soft)] px-4">
      <div className="glass-panel rounded-3xl p-8 max-w-md w-full text-center space-y-4">
        <div className="text-5xl">⚠️</div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Оплата отменена</h1>
          <p className="text-[var(--muted)]">
            Оплата была отменена. Подписка не активирована. Вы можете попробовать снова или выбрать другой тариф.
          </p>
        </div>
        <div className="space-y-3">
          <Link
            href="/company"
            className="btn-primary block w-full text-center"
          >
            Вернуться к выбору тарифа
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

