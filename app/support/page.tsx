'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'

export default function SupportPage() {
  const { data: session } = useSession()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState(session?.user?.email || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message, email }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Не удалось отправить тикет')
      }
      setSuccess('Мы получили обращение и свяжемся с вами в ближайшее время.')
      setSubject('')
      setMessage('')
    } catch (err: any) {
      setError(err.message || 'Ошибка отправки')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="glass-panel rounded-3xl p-6 space-y-3">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Поддержка</p>
        <h1 className="text-3xl font-semibold text-[var(--foreground)]">Свяжитесь с нами</h1>
        <p className="text-sm text-[var(--muted)]">
          Опишите проблему или вопрос. Мы ответим на email и в Telegram (если указан в аккаунте).
          Тикет создастся в системе без скрытых доплат, SLA: быстрый ответ в рабочее время.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="p-3 rounded-2xl bg-[var(--background-soft)]">
            <p className="font-semibold text-[var(--foreground)]">Каналы</p>
            <p className="text-[var(--muted)]">Email + Telegram уведомления</p>
          </div>
          <div className="p-3 rounded-2xl bg-[var(--background-soft)]">
            <p className="font-semibold text-[var(--foreground)]">SLA</p>
            <p className="text-[var(--muted)]">Ответ в часы работы, критичное — сразу</p>
          </div>
          <div className="p-3 rounded-2xl bg-[var(--background-soft)]">
            <p className="font-semibold text-[var(--foreground)]">Без ограничений</p>
            <p className="text-[var(--muted)]">Поддержка включена во все планы</p>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-6 space-y-4">
        {error && (
          <div className="rounded-xl border border-[var(--error)]/30 bg-[var(--error-soft)] px-4 py-3 text-[var(--error)]">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-[var(--success)]/30 bg-[var(--success-soft)] px-4 py-3 text-[var(--success)]">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--foreground)]">Тема</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                minLength={3}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                placeholder="Например: Не приходят письма"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--foreground)]">Email для ответа</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--foreground)]">Описание</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              minLength={10}
              rows={6}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
              placeholder="Опишите, что случилось, шаги воспроизведения и ожидаемый результат"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl px-5 py-2.5 bg-[var(--primary)] text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-60"
            >
              {loading ? 'Отправляем...' : 'Отправить тикет'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

