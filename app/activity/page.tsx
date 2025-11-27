'use client'

import { useEffect, useMemo, useState } from 'react'

interface ActivityUser {
  id: number
  name: string
  email: string
}

interface ActivityLog {
  id: number
  entityType: string
  entityId: number
  action: string
  description: string | null
  metadata?: Record<string, any> | null
  createdAt: string
  user?: ActivityUser | null
}

const ENTITY_MAP: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  deal: { label: 'Сделка', icon: '💼', color: 'text-emerald-500' },
  contact: { label: 'Контакт', icon: '👤', color: 'text-blue-500' },
  task: { label: 'Задача', icon: '🗓️', color: 'text-amber-500' },
  event: { label: 'Событие', icon: '📅', color: 'text-purple-500' },
}

const filters = [
  { id: 'all', label: 'Все' },
  { id: 'deal', label: 'Сделки' },
  { id: 'contact', label: 'Контакты' },
  { id: 'task', label: 'Задачи' },
  { id: 'event', label: 'События' },
]

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [limit, setLimit] = useState(50)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchLogs = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') {
        params.append('entityType', filter)
      }
      params.append('limit', String(limit))

      const response = await fetch(`/api/activity?${params.toString()}`, {
        cache: 'no-store',
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Не удалось загрузить активность')
      }

      setLogs(data.logs || [])
    } catch (err: any) {
      console.error('[activity][page] fetch error', err)
      setError(err.message || 'Не удалось загрузить активность')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [filter, limit])

  const filteredLogs = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return logs
    return logs.filter(log => {
      const description = log.description?.toLowerCase() ?? ''
      const action = log.action.toLowerCase()
      const label = ENTITY_MAP[log.entityType]?.label?.toLowerCase() ?? ''
      const userName = log.user?.name?.toLowerCase() ?? ''
      const userEmail = log.user?.email?.toLowerCase() ?? ''
      return (
        description.includes(term) ||
        action.includes(term) ||
        label.includes(term) ||
        userName.includes(term) ||
        userEmail.includes(term)
      )
    })
  }, [logs, searchTerm])

  const summary = useMemo(() => {
    const total = filteredLogs.length
    const today = filteredLogs.filter((log) => {
      const date = new Date(log.createdAt)
      const now = new Date()
      return (
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      )
    }).length
    const byType = filteredLogs.reduce<Record<string, number>>((acc, log) => {
      acc[log.entityType] = (acc[log.entityType] || 0) + 1
      return acc
    }, {})

    return { total, today, byType }
  }, [filteredLogs])

  const uniqueUsers = useMemo(() => {
    const ids = filteredLogs
      .map((log) => log.user?.id)
      .filter((id): id is number => typeof id === 'number')
    return new Set(ids).size
  }, [filteredLogs])

  const avgPerUser = uniqueUsers > 0 ? Math.max(1, Math.round(filteredLogs.length / uniqueUsers)) : 0

  const topEntity = useMemo(() => {
    const entries = Object.entries(summary.byType)
    if (entries.length === 0) return null
    const [entity, count] = entries.sort((a, b) => b[1] - a[1])[0]
    return {
      label: ENTITY_MAP[entity]?.label || entity,
      count,
    }
  }, [summary.byType])

  const lastActivityAt = filteredLogs[0]?.createdAt

  const summaryCards = [
    {
      title: 'Изменения сегодня',
      value: summary.today,
      subtitle: 'За последние 24 часа',
      gradient: 'from-blue-500 to-cyan-500',
      icon: '⚡',
    },
    {
      title: 'Событий в выборке',
      value: summary.total,
      subtitle: 'С учётом фильтров',
      gradient: 'from-purple-500 to-pink-500',
      icon: '📊',
    },
    {
      title: 'Активных пользователей',
      value: uniqueUsers,
      subtitle: uniqueUsers > 0 ? `${avgPerUser} действий на человека` : 'Пока нет действий',
      gradient: 'from-emerald-500 to-teal-500',
      icon: '👥',
    },
    {
      title: 'Ведущая сущность',
      value: topEntity ? topEntity.count : '—',
      subtitle: topEntity ? topEntity.label : 'Нет данных',
      gradient: 'from-amber-500 to-orange-500',
      icon: '🧩',
    },
  ]

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-[var(--muted)]">Загрузка ленты активности...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            Лента активности
          </p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">История действий</h1>
          <p className="text-sm text-[var(--muted)]">
            Анализируйте важные изменения по сделкам, контактам и задачам, чтобы команда оставалась синхронизированной.
          </p>
        </div>
        <div className="text-sm text-[var(--muted)]">
          {lastActivityAt
            ? `Обновлено ${new Date(lastActivityAt).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : 'Нет данных для выбранных фильтров'}
        </div>
      </div>

      <div className="glass-panel p-6 rounded-3xl">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.title} className="stat-card group relative overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">{card.subtitle}</p>
                  <p className={`stat-card-value bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent`}>
                    {card.value}
                  </p>
                  <p className="text-sm text-[var(--muted)]">{card.title}</p>
                </div>
                <div className="text-3xl">{card.icon}</div>
              </div>
              {card.title === 'Ведущая сущность' && (
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                  {Object.entries(summary.byType).length > 0 ? (
                    Object.entries(summary.byType).map(([type, count]) => (
                      <span key={type} className="rounded-full bg-white/80 border border-[var(--border)] px-3 py-1">
                        {ENTITY_MAP[type]?.label || type}: {count}
                      </span>
                    ))
                  ) : (
                    <span className="text-[var(--muted-soft)]">Нет данных</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel p-6 rounded-3xl space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <div className="flex-1 min-w-[220px]">
            <input
              type="text"
              placeholder="Поиск по действию, описанию или пользователю..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all min-w-[150px]"
            >
              {[25, 50, 100, 200].map((value) => (
                <option key={value} value={value}>
                  Последние {value}
                </option>
              ))}
            </select>
            <button
              onClick={fetchLogs}
              className="btn-secondary text-sm"
              disabled={loading}
            >
              ↻ Обновить
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                filter === item.id
                  ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-lg'
                  : 'bg-white/80 text-[var(--muted)] border border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {error && (
          <div className="rounded-2xl border border-[var(--error)]/30 bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--error)]">
            {error}
          </div>
        )}
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          Показано записей: {filteredLogs.length}
        </p>
      </div>

      <div className="glass-panel p-6 rounded-3xl">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="loading-spinner h-10 w-10 border-2 border-b-transparent border-[var(--primary)]" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <h3 className="empty-state-title">Нет записей по текущим условиям</h3>
            <p className="empty-state-description">
              {searchTerm || filter !== 'all'
                ? 'Попробуйте изменить фильтры или очистить поиск'
                : 'Выполните действия в CRM, чтобы увидеть историю изменений.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="card-interactive flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">
                      {ENTITY_MAP[log.entityType]?.icon || '📝'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {ENTITY_MAP[log.entityType]?.label || log.entityType}{' '}
                        <span className="text-[var(--muted)]">#{log.entityId}</span>
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {log.action === 'created'
                          ? 'Создано'
                          : log.action === 'updated'
                          ? 'Обновлено'
                          : log.action === 'stage_changed'
                          ? 'Изменение этапа'
                          : log.action}
                        {log.user && (
                          <>
                            {' • '}
                            {log.user.name || log.user.email}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-[var(--muted)]">
                    {new Date(log.createdAt).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {log.description && (
                  <p className="text-sm text-[var(--foreground-soft)]">{log.description}</p>
                )}

                {log.metadata && renderMetadata(log.metadata)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function renderMetadata(metadata: Record<string, any>) {
  const items = Object.entries(metadata).filter(
    ([, value]) => value !== null && value !== undefined && value !== ''
  )

  if (items.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {items.map(([key, value]) => (
        <span
          key={key}
          className="rounded-full bg-white/80 px-3 py-1 text-xs text-[var(--foreground-soft)] border border-[var(--border)]"
        >
          <span className="uppercase tracking-[0.3em] text-[10px] text-[var(--muted-soft)] mr-2">
            {key}
          </span>
          <span>{String(value)}</span>
        </span>
      ))}
    </div>
  )
}

