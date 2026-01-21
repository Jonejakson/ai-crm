'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { isOwner as isOwnerEmail } from '@/lib/owner'

type Ticket = {
  id: number
  subject: string
  message: string
  email: string
  status: string
  createdAt: string
  updatedAt: string
  company: { id: number; name: string }
  user: { id: number; name: string; email: string } | null
}

const statusTabs = [
  { id: 'all', label: 'Все' },
  { id: 'open', label: 'Открытые' },
  { id: 'in_progress', label: 'В работе' },
  { id: 'resolved', label: 'Решенные' },
]

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

export default function OpsSupportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [activeStatus, setActiveStatus] = useState('all')
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)

  const isOwner = session?.user?.role === 'owner' || isOwnerEmail(session?.user?.email)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated' && !isOwner) {
      router.push('/')
    }
  }, [status, isOwner, router])

  const loadTickets = async () => {
    try {
      setLoading(true)
      setError(null)
      const url = new URL('/api/support/tickets', window.location.origin)
      if (activeStatus && activeStatus !== 'all') {
        url.searchParams.set('status', activeStatus)
      }
      const res = await fetch(url.toString())
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Не удалось загрузить тикеты')
      }
      const data = await res.json()
      setTickets(data.tickets || [])
      if (data.tickets?.length && !selectedTicketId) {
        setSelectedTicketId(data.tickets[0].id)
      }
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить тикеты')
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      const res = await fetch('/api/support/sync-tickets', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка синхронизации')
      }
      await loadTickets()
    } catch (e: any) {
      setError(e?.message || 'Ошибка синхронизации')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated' && isOwner) {
      loadTickets()
    }
  }, [status, isOwner, activeStatus])

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) || null,
    [tickets, selectedTicketId]
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Тикеты поддержки</h1>
          <p className="text-[var(--muted)] text-sm">
            Управление тикетами поддержки. Отвечайте на тикеты здесь или с почты info@flamecrm.ru
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSync} className="btn-secondary" disabled={syncing}>
            {syncing ? 'Синхронизация…' : 'Синхронизировать с почтой'}
          </button>
          <button onClick={loadTickets} className="btn-secondary" disabled={loading}>
            {loading ? 'Обновление…' : 'Обновить'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveStatus(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeStatus === tab.id
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--background-soft)] text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] text-sm font-semibold text-[var(--foreground)]">
              Тикеты ({tickets.length})
            </div>
            {loading ? (
              <div className="px-5 py-6 text-sm text-[var(--muted)]">Загрузка…</div>
            ) : tickets.length === 0 ? (
              <div className="px-5 py-6 text-sm text-[var(--muted)]">Тикетов нет</div>
            ) : (
              <div className="divide-y divide-[var(--border)] max-h-[520px] overflow-y-auto">
                {tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={`w-full text-left px-5 py-4 hover:bg-[var(--background)] transition ${
                      selectedTicketId === ticket.id ? 'bg-[var(--background-soft)]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[var(--foreground)] line-clamp-1">
                        {ticket.subject}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full ${statusBadge(ticket.status)}`}>
                        {statusLabel(ticket.status)}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--muted)] mt-1 line-clamp-1">
                      {ticket.company?.name} · {new Date(ticket.createdAt).toLocaleString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 min-h-[520px]">
            {!selectedTicket ? (
              <div className="text-sm text-[var(--muted)] text-center py-20">
                Выберите тикет для просмотра
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-[var(--foreground)]">
                      {selectedTicket.subject}
                    </h2>
                    <p className="text-xs text-[var(--muted)]">
                      #{selectedTicket.id} · {new Date(selectedTicket.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusBadge(selectedTicket.status)}`}>
                    {statusLabel(selectedTicket.status)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
                    <p className="text-xs text-[var(--muted)]">Компания</p>
                    <p className="font-semibold text-[var(--foreground)]">{selectedTicket.company?.name}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
                    <p className="text-xs text-[var(--muted)]">Отправитель</p>
                    <p className="font-semibold text-[var(--foreground)]">
                      {selectedTicket.user?.name || selectedTicket.email}
                    </p>
                    <p className="text-xs text-[var(--muted)]">{selectedTicket.email}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 text-sm text-[var(--foreground)] whitespace-pre-wrap">
                  {selectedTicket.message}
                </div>

                <div className="flex items-center justify-end">
                  <a
                    href={`mailto:${selectedTicket.email}?subject=Re:%20${encodeURIComponent(
                      selectedTicket.subject
                    )}`}
                    className="btn-secondary text-sm"
                  >
                    Ответить по email
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
