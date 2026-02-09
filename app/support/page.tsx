'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

type TicketMessage = {
  id: number
  message: string
  fromEmail: string
  fromName: string | null
  isFromAdmin: boolean
  createdAt: string
}

type Ticket = {
  id: number
  ticketId?: string | null
  subject: string
  message: string
  email: string
  status: string
  createdAt: string
  messages?: TicketMessage[]
}

const statusLabel = (status: string) => {
  if (status === 'open') return 'Открыт'
  if (status === 'in_progress') return 'В работе'
  if (status === 'resolved') return 'Решен'
  if (status === 'closed') return 'Закрыт'
  return status
}

const statusBadge = (status: string) => {
  if (status === 'open') return 'bg-amber-100 text-amber-800'
  if (status === 'in_progress') return 'bg-blue-100 text-blue-800'
  if (status === 'resolved') return 'bg-green-100 text-green-800'
  if (status === 'closed') return 'bg-gray-100 text-gray-700'
  return 'bg-gray-100 text-gray-700'
}

export default function SupportPage() {
  const { data: session } = useSession()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState(session?.user?.email || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [showNewForm, setShowNewForm] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [replySending, setReplySending] = useState(false)

  const loadTickets = useCallback(async () => {
    try {
      setTicketsLoading(true)
      const res = await fetch('/api/support/my-tickets')
      if (!res.ok) throw new Error('Не удалось загрузить тикеты')
      const data = await res.json()
      setTickets(data.tickets || [])
    } catch (e: any) {
      console.error('Load tickets:', e)
    } finally {
      setTicketsLoading(false)
    }
  }, [])

  const loadTicketDetails = useCallback(async (ticketId: number) => {
    try {
      setDetailsLoading(true)
      const res = await fetch(`/api/support/my-tickets/${ticketId}`)
      if (!res.ok) throw new Error('Не удалось загрузить тикет')
      const data = await res.json()
      setSelectedTicket(data.ticket as Ticket)
    } catch (e: any) {
      setSelectedTicket(null)
    } finally {
      setDetailsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  useEffect(() => {
    if (selectedTicketId) {
      loadTicketDetails(selectedTicketId)
    } else {
      setSelectedTicket(null)
    }
  }, [selectedTicketId, loadTicketDetails])

  useEffect(() => {
    if (session?.user?.email) setEmail(session.user.email)
  }, [session?.user?.email])

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
      setSuccess('Тикет создан. Вы можете видеть переписку ниже.')
      setSubject('')
      setMessage('')
      await loadTickets()
      if (data.ticket?.id) {
        setSelectedTicketId(data.ticket.id)
        setShowNewForm(false)
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка отправки')
    } finally {
      setLoading(false)
    }
  }

  const handleReply = async () => {
    if (!selectedTicketId || !replyText.trim()) return
    try {
      setReplySending(true)
      const res = await fetch(`/api/support/my-tickets/${selectedTicketId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Не удалось отправить')
      setReplyText('')
      setSelectedTicket(data.ticket as Ticket)
    } catch (e: any) {
      setError((e as Error).message)
    } finally {
      setReplySending(false)
    }
  }

  const formatDate = (s: string) => {
    const d = new Date(s)
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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

      <div className="glass-panel rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Мои тикеты</h2>
          <button
            type="button"
            onClick={() => { setShowNewForm(true); setSelectedTicketId(null); setSelectedTicket(null); }}
            className="text-sm font-medium text-[var(--primary)] hover:underline"
          >
            + Новый тикет
          </button>
        </div>

        {ticketsLoading ? (
          <p className="text-[var(--muted)]">Загрузка...</p>
        ) : tickets.length === 0 ? (
          <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
            <p className="text-[var(--muted)] mb-4">У вас пока нет тикетов. Создайте первый:</p>
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
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 space-y-2 max-h-[400px] overflow-y-auto">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setSelectedTicketId(t.id); setShowNewForm(false); }}
                  className={`w-full text-left rounded-xl p-3 border transition ${
                    selectedTicketId === t.id
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                      : 'border-[var(--border)] hover:bg-[var(--background-soft)]'
                  }`}
                >
                  <div className="font-medium text-sm truncate">{t.subject}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(t.status)}`}>
                      {statusLabel(t.status)}
                    </span>
                    <span className="text-xs text-[var(--muted)]">{formatDate(t.createdAt)}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="lg:col-span-2">
              {showNewForm ? (
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
              ) : selectedTicket ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-[var(--foreground)]">{selectedTicket.subject}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${statusBadge(selectedTicket.status)}`}>
                      {statusLabel(selectedTicket.status)}
                    </span>
                  </div>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {detailsLoading ? (
                      <p className="text-[var(--muted)]">Загрузка...</p>
                    ) : (
                      (selectedTicket.messages || []).map((msg) => (
                        <div
                          key={msg.id}
                          className={`rounded-xl p-3 ${
                            msg.isFromAdmin
                              ? 'bg-blue-50 border border-blue-100'
                              : 'bg-[var(--background-soft)] border border-[var(--border)]'
                          }`}
                        >
                          <div className="flex items-center gap-2 text-xs text-[var(--muted)] mb-1">
                            <span className="font-medium">{msg.isFromAdmin ? 'Поддержка' : msg.fromName || msg.fromEmail}</span>
                            <span>{formatDate(msg.createdAt)}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="space-y-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={3}
                      placeholder="Добавить ответ..."
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleReply}
                        disabled={replySending || !replyText.trim()}
                        className="rounded-2xl px-5 py-2.5 bg-[var(--primary)] text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-60"
                      >
                        {replySending ? 'Отправка...' : 'Отправить ответ'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[var(--muted)]">Выберите тикет слева или создайте новый.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
