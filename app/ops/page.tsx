'use client'

import { useEffect, useState } from 'react'

type Metrics = {
  ok: boolean
  timestamp: string
  dbOk: boolean
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

export default function OpsPage() {
  const [data, setData] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<{ ok: boolean; startedAt?: string; uptimeSeconds?: number } | null>(null)

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

  useEffect(() => {
    load()
    const timer = setInterval(load, 60_000) // автообновление раз в минуту
    return () => clearInterval(timer)
  }, [])

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


