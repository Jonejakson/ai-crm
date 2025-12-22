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
  unreadMessagesCount?: number
  messages: Array<{
    id: number
    message: string
    fromEmail: string
    fromName: string | null
    isFromAdmin: boolean
    isRead?: boolean
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
  const [expandedTickets, setExpandedTickets] = useState<Set<number>>(new Set())
  const [replyMessage, setReplyMessage] = useState<Record<number, string>>({})
  const [replying, setReplying] = useState<Record<number, boolean>>({})

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

  const handleReply = async (ticketId: number) => {
    const message = replyMessage[ticketId]?.trim()
    if (!message) return

    try {
      setReplying(prev => ({ ...prev, [ticketId]: true }))
      const res = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Не удалось отправить ответ')
      }

      setReplyMessage(prev => ({ ...prev, [ticketId]: '' }))
      await loadTickets()
    } catch (e: any) {
      setError(e?.message || 'Ошибка отправки ответа')
    } finally {
      setReplying(prev => ({ ...prev, [ticketId]: false }))
    }
  }

  const toggleTicket = async (ticket: SupportTicket) => {
    const isExpanded = expandedTickets.has(ticket.id)
    
    if (!isExpanded) {
      // При открытии тикета загружаем полные данные и отмечаем как прочитанные
      try {
        const res = await fetch(`/api/support/tickets/${ticket.id}`)
        if (res.ok) {
          const data = await res.json()
          // Обновляем тикет в списке
          setTickets(prev => prev.map(t => t.id === ticket.id ? data.ticket : t))
        }
      } catch (error) {
        console.error('Error loading ticket details:', error)
      }
    }
    
    setExpandedTickets(prev => {
      const newSet = new Set(prev)
      if (isExpanded) {
        newSet.delete(ticket.id)
      } else {
        newSet.add(ticket.id)
      }
      return newSet
    })
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
            {tickets.map((ticket) => {
              const isExpanded = expandedTickets.has(ticket.id)
              const unreadCount = ticket.unreadMessagesCount || 0
              
              return (
                <div
                  key={ticket.id}
                  className="rounded-xl border border-[var(--border)] bg-white overflow-hidden transition-all"
                >
                  {/* Заголовок тикета */}
                  <div
                    onClick={() => toggleTicket(ticket)}
                    className="p-4 cursor-pointer hover:bg-[var(--background-soft)] transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-[var(--muted)]">{ticket.ticketId}</span>
                          <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                            {getStatusLabel(ticket.status)}
                          </span>
                          {unreadCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-red-500 text-white font-medium">
                              {unreadCount} новое
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-[var(--foreground)]">{ticket.subject}</h3>
                        <p className="text-sm text-[var(--muted)] mt-1 line-clamp-2">{ticket.message}</p>
                      </div>
                      <div className="text-xs text-[var(--muted)] ml-4">
                        {new Date(ticket.createdAt).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                    <div className="text-xs text-[var(--muted)] mt-2 flex items-center justify-between">
                      <span>Сообщений: {ticket.messages.length}</span>
                      <span className="text-[var(--primary)]">
                        {isExpanded ? 'Свернуть' : 'Развернуть'}
                      </span>
                    </div>
                  </div>

                  {/* Раскрывающееся содержимое */}
                  {isExpanded && (
                    <div className="border-t border-[var(--border)] p-4 space-y-4 bg-[var(--background-soft)]">
                      {/* Переписка */}
                      <div className="space-y-3">
                        <h3 className="font-semibold text-[var(--foreground)]">Переписка</h3>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto">
                          {ticket.messages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`p-3 rounded-lg ${
                                msg.isFromAdmin
                                  ? 'bg-[var(--primary-soft)] border border-[var(--primary)]'
                                  : 'bg-white border border-[var(--border)]'
                              } ${!msg.isRead && msg.isFromAdmin ? 'ring-2 ring-red-300' : ''}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-medium">
                                  {msg.isFromAdmin ? 'Поддержка' : msg.fromName || msg.fromEmail}
                                  {!msg.isRead && msg.isFromAdmin && (
                                    <span className="ml-2 text-xs text-red-600">● Новое</span>
                                  )}
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
                          value={replyMessage[ticket.id] || ''}
                          onChange={(e) => setReplyMessage(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                          placeholder="Введите ответ..."
                          rows={4}
                          className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                        />
                        <button
                          onClick={() => handleReply(ticket.id)}
                          disabled={!replyMessage[ticket.id]?.trim() || replying[ticket.id]}
                          className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white font-medium text-sm hover:opacity-90 disabled:opacity-50"
                        >
                          {replying[ticket.id] ? 'Отправка...' : 'Отправить ответ'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Форма создания нового тикета */}
      <div className="glass-panel rounded-3xl p-6 space-y-4">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">Создать тикет</h2>
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

