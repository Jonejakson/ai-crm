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

  const summary = useMemo(() => {
    const total = logs.length
    const today = logs.filter((log) => {
      const date = new Date(log.createdAt)
      const now = new Date()
      return (
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      )
    }).length
    const byType = logs.reduce<Record<string, number>>((acc, log) => {
      acc[log.entityType] = (acc[log.entityType] || 0) + 1
      return acc
    }, {})

    return { total, today, byType }
  }, [logs])

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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
            Лента активности
          </p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">История действий</h1>
          <p className="text-sm text-[var(--muted)]">
            Отслеживайте изменения по сделкам, контактам и задачам в реальном времени.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-2xl border border-white/60 bg-white/80 px-4 py-2 text-sm focus:border-[var(--primary)] focus:ring-0"
          >
            {[25, 50, 100, 200].map((value) => (
              <option key={value} value={value}>
                Последние {value}
              </option>
            ))}
          </select>
          <button
            onClick={fetchLogs}
            className="btn-secondary"
            disabled={loading}
          >
            ↻ Обновить
          </button>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-3xl">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            {
              label: 'Изменений сегодня',
              value: summary.today,
              description: 'За день',
              gradient: 'from-blue-500 to-cyan-500',
              icon: '✨',
            },
            {
              label: 'Логов в выборке',
              value: summary.total,
              description: 'Всего событий',
              gradient: 'from-purple-500 to-pink-500',
              icon: '📊',
            },
            {
              label: 'Активные сущности',
              value: Object.keys(summary.byType).length,
              description: 'По типам',
              gradient: 'from-emerald-500 to-teal-500',
              icon: '🧩',
            },
          ].map((card) => (
            <div key={card.label} className="stat-card group relative overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{card.description}</p>
                  <p className={`stat-card-value bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent`}>
                    {card.value}
                  </p>
                  <p className="text-sm text-[var(--muted)]">{card.label}</p>
                </div>
                <div className="text-3xl">{card.icon}</div>
              </div>
              {card.label === 'Активные сущности' && (
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                  {Object.entries(summary.byType).map(([type, count]) => (
                    <span key={type} className="rounded-full bg-white/80 border border-[var(--border)] px-3 py-1">
                      {ENTITY_MAP[type]?.label || type}: {count}
                    </span>
                  ))}
                  {Object.keys(summary.byType).length === 0 && (
                    <span className="text-[var(--muted-soft)]">Нет данных</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel p-6 rounded-3xl space-y-6">
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

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="loading-spinner h-10 w-10 border-2 border-b-transparent border-[var(--primary)]" />
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <h3 className="empty-state-title">Пока нет записей активности</h3>
            <p className="empty-state-description">
              Выполните действия в CRM, чтобы увидеть историю изменений.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
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

