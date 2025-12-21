'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

type SupportTicket = {
  id: number
  ticketId: string
  subject: string
  message: string
  email: string
  status: string
  createdAt: string
  updatedAt: string
  messages: Array<{
    id: number
    message: string
    fromEmail: string
    fromName: string | null
    isFromAdmin: boolean
    createdAt: string
  }>
}

export default function SupportPage() {
  const { data: session } = useSession()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState(session?.user?.email || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [replyMessage, setReplyMessage] = useState('')
  const [replying, setReplying] = useState(false)

  const loadTickets = async () => {
    try {
      setLoadingTickets(true)
      const res = await fetch('/api/support')
      if (!res.ok) {
        throw new Error('Не удалось загрузить тикеты')
      }
      const data = await res.json()
      setTickets(data.tickets || [])
    } catch (err) {
      console.error('Ошибка загрузки тикетов:', err)
    } finally {
      setLoadingTickets(false)
    }
  }

  useEffect(() => {
    if (session?.user) {
      loadTickets()
    }
  }, [session])

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
      await loadTickets() // Обновляем список тикетов
    } catch (err: any) {
      setError(err.message || 'Ошибка отправки')
    } finally {
      setLoading(false)
    }
  }

  const handleReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return

    try {
      setReplying(true)
      const res = await fetch(`/api/support/tickets/${selectedTicket.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyMessage }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Не удалось отправить ответ')
      }

      setReplyMessage('')
      await loadTickets()
      // Обновляем выбранный тикет
      const updatedRes = await fetch(`/api/support/tickets/${selectedTicket.id}`)
      if (updatedRes.ok) {
        const data = await updatedRes.json()
        setSelectedTicket(data.ticket)
      }
    } catch (e: any) {
      setError(e?.message || 'Ошибка отправки ответа')
    } finally {
      setReplying(false)
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return 'Открыт'
      case 'in_progress':
        return 'В работе'
      case 'resolved':
        return 'Решен'
      case 'closed':
        return 'Закрыт'
      default:
        return status
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="glass-panel rounded-3xl p-6 space-y-3">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Поддержка</p>
        <h1 className="text-3xl font-semibold text-[var(--foreground)]">Свяжитесь с нами</h1>
        <p className="text-sm text-[var(--muted)]">
          Опишите проблему или вопрос. Мы ответим на email и в Telegram (если указан в аккаунте).
          Тикет создастся в системе, SLA: быстрый ответ в рабочее время.
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

      {/* Список тикетов */}
      {tickets.length > 0 && (
        <div className="glass-panel rounded-3xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Мои тикеты</h2>
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedTicket?.id === ticket.id
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                    : 'border-[var(--border)] bg-white hover:border-[var(--primary)]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-[var(--muted)]">{ticket.ticketId}</span>
                      <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                        {getStatusLabel(ticket.status)}
                      </span>
                    </div>
                    <h3 className="font-semibold text-[var(--foreground)]">{ticket.subject}</h3>
                    <p className="text-sm text-[var(--muted)] mt-1 line-clamp-2">{ticket.message}</p>
                  </div>
                  <div className="text-xs text-[var(--muted)] ml-4">
                    {new Date(ticket.createdAt).toLocaleDateString('ru-RU')}
                  </div>
                </div>
                <div className="text-xs text-[var(--muted)] mt-2">
                  Сообщений: {ticket.messages.length}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Детали тикета */}
      {selectedTicket && (
        <div className="glass-panel rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              {selectedTicket.subject}
            </h2>
            <button
              onClick={() => setSelectedTicket(null)}
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Закрыть
            </button>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-[var(--foreground)]">Переписка</h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {selectedTicket.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg ${
                    msg.isFromAdmin
                      ? 'bg-[var(--primary-soft)] border border-[var(--primary)]'
                      : 'bg-[var(--background-soft)] border border-[var(--border)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">
                      {msg.isFromAdmin ? 'Поддержка' : msg.fromName || msg.fromEmail}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {new Date(msg.createdAt).toLocaleString('ru-RU')}
                    </div>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{msg.message}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Форма ответа */}
          <div className="space-y-3 pt-4 border-t border-[var(--border)]">
            <h3 className="font-semibold text-[var(--foreground)]">Ответить</h3>
            <textarea
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder="Введите ответ..."
              rows={4}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
            <button
              onClick={handleReply}
              disabled={!replyMessage.trim() || replying}
              className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white font-medium text-sm hover:opacity-90 disabled:opacity-50"
            >
              {replying ? 'Отправка...' : 'Отправить ответ'}
            </button>
          </div>
        </div>
      )}

      {/* Форма создания нового тикета */}
      <div className="glass-panel rounded-3xl p-6 space-y-4">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">
          {selectedTicket ? 'Создать новый тикет' : 'Создать тикет'}
        </h2>
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

