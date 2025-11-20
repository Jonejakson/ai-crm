'use client'

import Link from 'next/link'

export default function BillingCancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--background-soft)] via-white to-[var(--warning-soft)] px-4 py-10">
      <div className="glass-panel rounded-3xl p-8 max-w-2xl w-full space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-4xl">
              <span>⚠️</span>
              <span>⌛</span>
            </div>
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">Оплата отменена</h1>
            <p className="text-[var(--muted)]">
              Подписка не была активирована. Вы можете повторить оплату или изменить тариф в настройках компании.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--warning)]/30 bg-[var(--warning-soft)]/40 px-4 py-3 text-sm text-[var(--warning)]">
            <p className="uppercase tracking-[0.2em] text-xs text-[var(--warning)]/80">Что это значит</p>
            <p>
              На вашей карте не было списаний. Доступ останется на предыдущем тарифе до повторной оплаты.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: 'Шаг 1', value: 'Проверьте данные карты' },
            { label: 'Шаг 2', value: 'Попробуйте другой тариф или способ оплаты' },
            { label: 'Шаг 3', value: 'Напишите нам, если требуется помощь' },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{item.label}</p>
              <p className="text-sm font-semibold text-[var(--foreground)]">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-white/70 p-6 space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Если отмена произошла случайно, просто вернитесь в раздел тарифов и создайте новый платёж. Для вопросов по биллингу
            вы всегда можете написать на <a href="mailto:support@pocketcrm.io" className="text-[var(--primary)] underline">support@pocketcrm.io</a>.
          </p>
          <div className="flex flex-col md:flex-row gap-3">
            <Link href="/company" className="btn-primary flex-1 text-center">
              Вернуться к тарифам
            </Link>
            <Link href="/" className="btn-secondary flex-1 text-center">
              На главную
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

