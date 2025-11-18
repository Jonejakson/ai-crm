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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
            Лента активности
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">История действий</h1>
          <p className="text-sm text-slate-500">
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white/80 p-4 shadow-sm border border-white/60">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
              За день
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.today}</p>
            <p className="text-sm text-slate-500">Изменений сегодня</p>
          </div>
          <div className="rounded-2xl bg-white/80 p-4 shadow-sm border border-white/60">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
              Всего
            </p>
            <p className="mt-2 text-3xl font-semibold text-[var(--primary)]">
              {summary.total}
            </p>
            <p className="text-sm text-slate-500">Логов в выборке</p>
          </div>
          <div className="rounded-2xl bg-white/80 p-4 shadow-sm border border-white/60">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
              Активные сущности
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
              {Object.entries(summary.byType).map(([type, count]) => (
                <span
                  key={type}
                  className="rounded-full bg-white px-3 py-1 border border-white/50"
                >
                  {ENTITY_MAP[type]?.label || type}: {count}
                </span>
              ))}
              {Object.keys(summary.byType).length === 0 && (
                <span className="text-slate-400">Нет данных</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-3xl space-y-6">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`rounded-full px-4 py-2 text-sm border transition ${
                filter === item.id
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'bg-white/80 text-slate-600 border-white/60 hover:border-[var(--primary)] hover:text-[var(--primary)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-b-transparent border-[var(--primary)]" />
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/60 bg-white/60 p-8 text-center text-slate-500">
            Пока нет записей активности
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">
                      {ENTITY_MAP[log.entityType]?.icon || '📝'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {ENTITY_MAP[log.entityType]?.label || log.entityType}{' '}
                        <span className="text-slate-400">#{log.entityId}</span>
                      </p>
                      <p className="text-xs text-slate-500">
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
                  <span className="text-xs text-slate-400">
                    {new Date(log.createdAt).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {log.description && (
                  <p className="text-sm text-slate-700">{log.description}</p>
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
          className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 border border-white/60"
        >
          <span className="uppercase tracking-[0.3em] text-[10px] text-slate-400 mr-2">
            {key}
          </span>
          <span>{String(value)}</span>
        </span>
      ))}
    </div>
  )
}

