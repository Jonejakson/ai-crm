'use client'

import { useEffect, useState } from 'react'
import { isOwner } from '@/lib/owner'
import { useSession } from 'next-auth/react'

type OwnerMetrics = {
  ok: boolean
  timestamp: string
  metrics: {
    companiesTotal: number
    companies24h: number
    usersTotal: number
    activeUsers10m: number
    dealsTotal: number
    contactsTotal: number
    submissions24h: number
    subsActive: number
    subsTrial: number
  }
}

export default function OwnerOpsPage() {
  const { data: session, status } = useSession()
  const [data, setData] = useState<OwnerMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/owner/metrics')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Нет доступа или ошибка загрузки')
      }
      const json = (await res.json()) as OwnerMetrics
      setData(json)
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      load()
      const t = setInterval(load, 60_000)
      return () => clearInterval(t)
    }
  }, [status])

  if (status === 'loading') {
    return <div className="p-6 text-[var(--muted)]">Загрузка…</div>
  }

  if (!session?.user?.email || !isOwner(session.user.email)) {
    return <div className="p-6 text-red-600">Доступ запрещён</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Owner Dashboard</h1>
          <p className="text-[var(--muted)] text-sm">Метрики по всем компаниям (видит только владелец).</p>
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
          title="Компаний всего"
          value={data?.metrics?.companiesTotal ?? '-'}
          subtitle={`Новые 24ч: ${data?.metrics?.companies24h ?? '-'}`}
        />
        <MetricCard
          title="Пользователей"
          value={data?.metrics?.usersTotal ?? '-'}
          subtitle={`Активны 10м: ${data?.metrics?.activeUsers10m ?? '-'}`}
        />
        <MetricCard
          title="Сделок / Контактов"
          value={`${data?.metrics?.dealsTotal ?? '-'} / ${data?.metrics?.contactsTotal ?? '-'}`}
          subtitle="Всего по всем компаниям"
        />
        <MetricCard
          title="Сабмиты форм 24ч"
          value={data?.metrics?.submissions24h ?? '-'}
          subtitle="WebForm submissions (все компании)"
        />
        <MetricCard
          title="Подписки"
          value={`Актив: ${data?.metrics?.subsActive ?? 0}`}
          subtitle={`Trial: ${data?.metrics?.subsTrial ?? 0}`}
        />
        <MetricCard
          title="Время"
          value={data ? new Date(data.timestamp).toLocaleTimeString() : '-'}
          subtitle="Серверное время метрик"
        />
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  subtitle,
}: {
  title: string
  value: string | number
  subtitle?: string
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-2">
      <p className="text-sm text-[var(--muted)]">{title}</p>
      <div className="text-2xl font-semibold text-[var(--foreground)]">{value}</div>
      {subtitle && <p className="text-xs text-[var(--muted)]">{subtitle}</p>}
    </div>
  )
}


