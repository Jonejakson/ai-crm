'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type SupportTicket = {
  id: number
  ticketId: string
  subject: string
  message: string
  email: string
  status: string
  createdAt: string
  updatedAt: string
  user: {
    id: number
    email: string
    name: string | null
  } | null
  company: {
    id: number
    name: string
  }
  messages: Array<{
    id: number
    message: string
    fromEmail: string
    fromName: string | null
    isFromAdmin: boolean
    createdAt: string
  }>
}

type TicketsData = {
  success: boolean
  tickets: SupportTicket[]
  total: number
}

export default function OpsSupportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [replyMessage, setReplyMessage] = useState('')
  const [replying, setReplying] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Проверка доступа - только owner
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      if (session?.user?.role !== 'owner') {
        router.push('/')
        return
      }
    }
  }, [status, session, router])

  const loadTickets = async () => {
    try {
      setLoading(true)
      setError(null)
      const url = statusFilter !== 'all' 
        ? `/api/support/tickets?status=${statusFilter}`
        : '/api/support/tickets'
      const res = await fetch(url)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Не удалось загрузить тикеты')
      }
      const json = (await res.json()) as TicketsData
      setTickets(json.tickets)
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
    const timer = setInterval(() => {
      loadTickets()
    }, 30000) // автообновление раз в 30 секунд
    return () => clearInterval(timer)
  }, [statusFilter])

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
      alert(e?.message || 'Ошибка отправки ответа')
    } finally {
      setReplying(false)
    }
  }

  const handleStatusChange = async (ticketId: number, newStatus: string) => {
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        throw new Error('Не удалось обновить статус')
      }

      await loadTickets()
      if (selectedTicket?.id === ticketId) {
        const updatedRes = await fetch(`/api/support/tickets/${ticketId}`)
        if (updatedRes.ok) {
          const data = await updatedRes.json()
          setSelectedTicket(data.ticket)
        }
      }
    } catch (e: any) {
      alert(e?.message || 'Ошибка обновления статуса')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800'
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800'
      case 'resolved':
        return 'bg-green-100 text-green-800'
      case 'closed':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
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

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4" />
          <p className="text-[var(--muted)]">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Тикеты поддержки</h1>
          <p className="text-[var(--muted)] text-sm">
            Управление тикетами поддержки. Отвечайте на тикеты здесь или с почты info@flamecrm.ru
          </p>
        </div>
        <button onClick={loadTickets} className="btn-secondary" disabled={loading}>
          {loading ? 'Обновление…' : 'Обновить'}
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            statusFilter === 'all'
              ? 'bg-[var(--primary)] text-white'
              : 'bg-[var(--background-soft)] text-[var(--foreground)] hover:bg-[var(--border)]'
          }`}
        >
          Все
        </button>
        <button
          onClick={() => setStatusFilter('open')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            statusFilter === 'open'
              ? 'bg-[var(--primary)] text-white'
              : 'bg-[var(--background-soft)] text-[var(--foreground)] hover:bg-[var(--border)]'
          }`}
        >
          Открытые
        </button>
        <button
          onClick={() => setStatusFilter('in_progress')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            statusFilter === 'in_progress'
              ? 'bg-[var(--primary)] text-white'
              : 'bg-[var(--background-soft)] text-[var(--foreground)] hover:bg-[var(--border)]'
          }`}
        >
          В работе
        </button>
        <button
          onClick={() => setStatusFilter('resolved')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            statusFilter === 'resolved'
              ? 'bg-[var(--primary)] text-white'
              : 'bg-[var(--background-soft)] text-[var(--foreground)] hover:bg-[var(--border)]'
          }`}
        >
          Решенные
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Список тикетов */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Тикеты ({tickets.length})
          </h2>
          <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedTicket?.id === ticket.id
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                    : 'border-[var(--border)] bg-white hover:border-[var(--primary)] hover:bg-[var(--background-soft)]'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-[var(--muted)]">{ticket.ticketId}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(ticket.status)}`}>
                        {getStatusLabel(ticket.status)}
                      </span>
                    </div>
                    <h3 className="font-semibold text-[var(--foreground)]">{ticket.subject}</h3>
                    <p className="text-sm text-[var(--muted)] mt-1 line-clamp-2">{ticket.message}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-[var(--muted)]">
                  <span>{ticket.user?.name || ticket.email}</span>
                  <span>{new Date(ticket.createdAt).toLocaleDateString('ru-RU')}</span>
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  Сообщений: {ticket.messages.length}
                </div>
              </div>
            ))}
            {tickets.length === 0 && !loading && (
              <div className="text-center py-8 text-[var(--muted)]">Тикетов нет</div>
            )}
          </div>
        </div>

        {/* Детали тикета */}
        <div className="space-y-4">
          {selectedTicket ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  {selectedTicket.subject}
                </h2>
                <select
                  value={selectedTicket.status}
                  onChange={(e) => handleStatusChange(selectedTicket.id, e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-white text-sm"
                >
                  <option value="open">Открыт</option>
                  <option value="in_progress">В работе</option>
                  <option value="resolved">Решен</option>
                  <option value="closed">Закрыт</option>
                </select>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-white p-4 space-y-3">
                <div>
                  <div className="text-xs text-[var(--muted)] mb-1">От</div>
                  <div className="font-medium">{selectedTicket.user?.name || selectedTicket.email}</div>
                  <div className="text-sm text-[var(--muted)]">{selectedTicket.email}</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--muted)] mb-1">Компания</div>
                  <div className="font-medium">{selectedTicket.company.name}</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--muted)] mb-1">Создан</div>
                  <div className="text-sm">
                    {new Date(selectedTicket.createdAt).toLocaleString('ru-RU')}
                  </div>
                </div>
              </div>

              {/* Переписка */}
              <div className="space-y-3">
                <h3 className="font-semibold text-[var(--foreground)]">Переписка</h3>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
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
                          {msg.isFromAdmin ? 'Вы (Админ)' : msg.fromName || msg.fromEmail}
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
              <div className="space-y-3">
                <h3 className="font-semibold text-[var(--foreground)]">Ответить</h3>
                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Введите ответ..."
                  rows={4}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleReply}
                    disabled={!replyMessage.trim() || replying}
                    className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white font-medium text-sm hover:opacity-90 disabled:opacity-50"
                  >
                    {replying ? 'Отправка...' : 'Отправить ответ'}
                  </button>
                  <div className="text-xs text-[var(--muted)] flex items-center">
                    Или ответьте на email с тикетом {selectedTicket.ticketId}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-[var(--muted)]">
              Выберите тикет для просмотра
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

