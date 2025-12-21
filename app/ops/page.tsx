'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type Metrics = {
  ok: boolean
  timestamp: string
  dbOk: boolean
  uptimeSeconds?: number
  metrics: {
    usersTotal: number
    contactsTotal: number
    dealsTotal: number
    dealsLast24h: number
    contactsLast24h: number
    submissionsLast24h: number
    activeUsers10m: number
  }
}

type UserWithStats = {
  id: number
  email: string
  firstName: string
  lastName: string
  fullName: string
  phone: string | null
  role: string
  contactType: 'individual' | 'legal' | 'mixed' | 'unknown'
  company: {
    id: number
    name: string
    usersCount: number
  }
  stats: {
    dealsCount: number
    contactsCount: number
    tasksCount: number
  }
  createdAt: string
}

type UsersData = {
  ok: boolean
  users: UserWithStats[]
  total: number
}

export default function OpsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<{ ok: boolean; startedAt?: string; uptimeSeconds?: number } | null>(null)
  const [usersData, setUsersData] = useState<UsersData | null>(null)
  const [usersLoading, setUsersLoading] = useState(false)
  const [ticketsData, setTicketsData] = useState<{ tickets: any[]; total: number } | null>(null)
  const [ticketsLoading, setTicketsLoading] = useState(false)

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

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/ops/metrics')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Не удалось загрузить метрики')
      }
      const json = (await res.json()) as Metrics
      setData(json)

      // health-check
      try {
        const h = await fetch('/api/ops/health')
        const hj = await h.json()
        setHealth(hj)
      } catch (e) {
        setHealth({ ok: false })
      }
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      setUsersLoading(true)
      const res = await fetch('/api/ops/users')
      if (!res.ok) {
        throw new Error('Не удалось загрузить пользователей')
      }
      const json = (await res.json()) as UsersData
      setUsersData(json)
    } catch (e: any) {
      console.error('Ошибка загрузки пользователей:', e)
    } finally {
      setUsersLoading(false)
    }
  }

  const loadTickets = async () => {
    try {
      setTicketsLoading(true)
      const res = await fetch('/api/support/tickets?limit=5')
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        console.error('[ops] Ошибка загрузки тикетов:', res.status, errorData)
        // Устанавливаем пустые данные, чтобы блок отображался
        setTicketsData({ tickets: [], total: 0 })
        return
      }
      const json = await res.json()
      console.log('[ops] Тикеты загружены:', json)
      setTicketsData(json)
    } catch (e: any) {
      console.error('[ops] Ошибка загрузки тикетов:', e)
      // Устанавливаем пустые данные, чтобы блок отображался
      setTicketsData({ tickets: [], total: 0 })
    } finally {
      setTicketsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'owner') {
      load()
      loadUsers()
      loadTickets()
      const timer = setInterval(() => {
        load()
        loadUsers()
        loadTickets()
      }, 60_000) // автообновление раз в минуту
      return () => clearInterval(timer)
    }
  }, [status, session])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Операционный мониторинг</h1>
          <p className="text-[var(--muted)] text-sm">
            Живые метрики работоспособности и ключевые показатели (внутреннее).
          </p>
        </div>
        <button onClick={load} className="btn-secondary" disabled={loading}>
          {loading ? 'Обновление…' : 'Обновить'}
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="БД"
          value={data?.dbOk ? 'OK' : 'Ошибка'}
          subtitle={
            data
              ? `t=${new Date(data.timestamp).toLocaleTimeString()} · uptime=${Math.round(
                  (data.uptimeSeconds ?? 0) / 60
                )} мин`
              : ''
          }
          status={data?.dbOk ? 'ok' : 'warn'}
        />
        <MetricCard
          title="Активных за 10 мин"
          value={data?.metrics?.activeUsers10m ?? '-'}
          subtitle="По активности (logs)"
        />
        <MetricCard
          title="Сабмиты форм 24ч"
          value={data?.metrics?.submissionsLast24h ?? '-'}
          subtitle="WebForm submissions"
        />
        <MetricCard
          title="Сделок всего"
          value={data?.metrics?.dealsTotal ?? '-'}
          subtitle={`Новые 24ч: ${data?.metrics?.dealsLast24h ?? '-'}`}
        />
        <MetricCard
          title="Контактов всего"
          value={data?.metrics?.contactsTotal ?? '-'}
          subtitle={`Новые 24ч: ${data?.metrics?.contactsLast24h ?? '-'}`}
        />
        <MetricCard
          title="Пользователей"
          value={data?.metrics?.usersTotal ?? '-'}
          subtitle="Всего в компании"
        />
        <MetricCard
          title="Health"
          value={health?.ok ? 'OK' : 'Ошибка'}
          subtitle={
            health?.startedAt
              ? `start: ${new Date(health.startedAt).toLocaleString()} · uptime=${Math.round(
                  (health.uptimeSeconds ?? 0) / 60
                )} мин`
              : ''
          }
          status={health?.ok ? 'ok' : 'warn'}
        />
      </div>

      {/* Блок тикетов поддержки - ВСЕГДА ОТОБРАЖАЕТСЯ */}
      <div className="rounded-2xl border-4 border-red-500 bg-yellow-100 p-6 space-y-4" style={{ minHeight: '200px', display: 'block !important' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-red-600">🔥 ТИКЕТЫ ПОДДЕРЖКИ 🔥</h2>
            <p className="text-[var(--muted)] text-sm">
              Последние тикеты. <a href="/ops/support" className="text-[var(--primary)] hover:underline">Открыть все →</a>
            </p>
          </div>
          <button onClick={loadTickets} className="btn-secondary" disabled={ticketsLoading}>
            {ticketsLoading ? 'Обновление…' : 'Обновить'}
          </button>
        </div>

        {ticketsLoading && !ticketsData ? (
          <div className="text-center py-4 text-[var(--muted)]">Загрузка тикетов…</div>
        ) : ticketsData?.tickets && ticketsData.tickets.length > 0 ? (
          <div className="space-y-2">
            {ticketsData.tickets.slice(0, 5).map((ticket: any) => (
              <a
                key={ticket.id}
                href={`/ops/support`}
                className="block p-3 rounded-lg border border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--background-soft)] transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-[var(--muted)]">{ticket.ticketId}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          ticket.status === 'open'
                            ? 'bg-blue-100 text-blue-800'
                            : ticket.status === 'in_progress'
                            ? 'bg-yellow-100 text-yellow-800'
                            : ticket.status === 'resolved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {ticket.status === 'open'
                          ? 'Открыт'
                          : ticket.status === 'in_progress'
                          ? 'В работе'
                          : ticket.status === 'resolved'
                          ? 'Решен'
                          : 'Закрыт'}
                      </span>
                    </div>
                    <h3 className="font-semibold text-[var(--foreground)] text-sm">{ticket.subject}</h3>
                    <p className="text-xs text-[var(--muted)] mt-1 line-clamp-1">{ticket.message}</p>
                  </div>
                  <div className="text-xs text-[var(--muted)] ml-4 whitespace-nowrap">
                    {new Date(ticket.createdAt).toLocaleDateString('ru-RU')}
                  </div>
                </div>
                <div className="text-xs text-[var(--muted)] mt-2">
                  {ticket.user?.name || ticket.email} · Сообщений: {ticket.messages?.length || 0}
                </div>
              </a>
            ))}
            {ticketsData.total > 5 && (
              <div className="text-center pt-2">
                <a href="/ops/support" className="text-sm text-[var(--primary)] hover:underline">
                  Показать все ({ticketsData.total}) →
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4 text-[var(--muted)]">
            {ticketsData ? 'Тикетов нет' : 'Нажмите "Обновить" для загрузки тикетов'}
          </div>
        )}
      </div>

      {/* Блок с пользователями */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Пользователи и компании</h2>
            <p className="text-[var(--muted)] text-sm">
              Список пользователей с информацией о компаниях и основных показателях
            </p>
          </div>
          <button onClick={loadUsers} className="btn-secondary" disabled={usersLoading}>
            {usersLoading ? 'Обновление…' : 'Обновить'}
          </button>
        </div>

        {usersLoading && !usersData ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
            Загрузка пользователей…
          </div>
        ) : usersData?.users && usersData.users.length > 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--background)] border-b border-[var(--border)]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                      Пользователь
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                      Тип
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                      Компания
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                      Пользователей в компании
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                      Сделок
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                      Контактов
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                      Задач
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                      Роль
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {usersData.users.map((user) => (
                    <tr key={user.id} className="hover:bg-[var(--background)] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="text-sm font-medium text-[var(--foreground)]">
                            {user.firstName} {user.lastName && <span>{user.lastName}</span>}
                          </div>
                          <div className="text-xs text-[var(--muted)]">{user.email}</div>
                          {user.phone && (
                            <div className="text-xs text-[var(--muted)]">{user.phone}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.contactType === 'legal'
                              ? 'bg-orange-100 text-orange-800'
                              : user.contactType === 'individual'
                              ? 'bg-green-100 text-green-800'
                              : user.contactType === 'mixed'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {user.contactType === 'legal'
                            ? 'Юр. лицо'
                            : user.contactType === 'individual'
                            ? 'Физ. лицо'
                            : user.contactType === 'mixed'
                            ? 'Смешанный'
                            : 'Не определен'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-[var(--foreground)] font-medium">
                          {user.company.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-[var(--foreground)]">
                          {user.company.usersCount}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-[var(--foreground)]">
                          {user.stats.dealsCount}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-[var(--foreground)]">
                          {user.stats.contactsCount}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-[var(--foreground)]">
                          {user.stats.tasksCount}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.role === 'admin' || user.role === 'owner'
                              ? 'bg-blue-100 text-blue-800'
                              : user.role === 'manager'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {user.role === 'owner' ? 'Владелец' : user.role === 'admin' ? 'Админ' : user.role === 'manager' ? 'Менеджер' : 'Пользователь'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 bg-[var(--background)] border-t border-[var(--border)] text-sm text-[var(--muted)]">
              Всего пользователей: {usersData.total}
            </div>
          </div>
        ) : usersData && usersData.users && usersData.users.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
            Пользователи не найдены
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
            {usersData ? 'Загрузка данных...' : 'Нажмите "Обновить" для загрузки пользователей'}
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  subtitle,
  status,
}: {
  title: string
  value: string | number
  subtitle?: string
  status?: 'ok' | 'warn'
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">{title}</p>
        {status && (
          <span
            className={`text-xs font-semibold px-2 py-1 rounded-full ${
              status === 'ok'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                : 'bg-amber-50 text-amber-700 border border-amber-100'
            }`}
          >
            {status === 'ok' ? 'OK' : 'Проверить'}
          </span>
        )}
      </div>
      <div className="text-2xl font-semibold text-[var(--foreground)]">{value}</div>
      {subtitle && <p className="text-xs text-[var(--muted)]">{subtitle}</p>}
    </div>
  )
}


