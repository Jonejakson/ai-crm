'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/Modal'
import ExtendSubscriptionModal from '@/components/ExtendSubscriptionModal'

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
    subsTotal: number
    subsActive: number
    subsTrial: number
    subsCanceled: number
  }
}

type OpsMetrics = {
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

type CompanySummary = {
  id: number
  name: string
  inn: string | null
  isLegalEntity: boolean
  createdAt: string
  trialEndsAt: string | null
  usersCount: number
  activeUsers10m: number
  subscription: {
    id: number
    status: string
    planName: string | null
    planSlug: string | null
    billingInterval: string
    currentPeriodEnd: string | null
    trialEndsAt: string | null
    cancelAtPeriodEnd: boolean
  } | null
}

type CompanyDetails = {
  company: {
    id: number
    name: string
    inn: string | null
    isLegalEntity: boolean
    createdAt: string
    updatedAt: string
    trialEndsAt: string | null
    users: Array<{
      id: number
      name: string
      email: string
      phone: string | null
      role: string
      createdAt: string
    }>
  }
  subscription: CompanySummary['subscription']
  stats: {
    usersTotal: number
    activeUsers10m: number
    contactsTotal: number
  }
  contacts: Array<{
    id: number
    name: string
    email: string | null
    phone: string | null
    company: string | null
    position: string | null
    inn: string | null
    createdAt: string
    user: { id: number; name: string; email: string }
  }>
  contactsLimit: number
}

const statusLabel = (status?: string | null) => {
  if (!status) return 'Нет подписки'
  if (status === 'ACTIVE') return 'Активна'
  if (status === 'TRIAL') return 'Пробный период'
  if (status === 'PAST_DUE') return 'Просрочена'
  if (status === 'CANCELED') return 'Отменена'
  return status
}

const formatDate = (value?: string | null) => {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

export default function OwnerPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [tab, setTab] = useState<'companies' | 'health'>('companies')
  const [metrics, setMetrics] = useState<OwnerMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [companies, setCompanies] = useState<CompanySummary[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(false)
  const [companiesError, setCompaniesError] = useState<string | null>(null)

  const [opsMetrics, setOpsMetrics] = useState<OpsMetrics | null>(null)
  const [health, setHealth] = useState<{ ok: boolean; startedAt?: string; uptimeSeconds?: number } | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [details, setDetails] = useState<CompanyDetails | null>(null)

  const [extendModalOpen, setExtendModalOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<{ id: number; name: string } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      if (session?.user?.role !== 'owner') {
        router.push('/')
      }
    }
  }, [status, session, router])

  const loadMetrics = async () => {
    try {
      setMetricsLoading(true)
      const res = await fetch('/api/owner/metrics')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Не удалось загрузить метрики')
      }
      setMetrics((await res.json()) as OwnerMetrics)
    } catch (e: any) {
      console.error('[owner][metrics]', e)
    } finally {
      setMetricsLoading(false)
    }
  }

  const loadCompanies = async () => {
    try {
      setCompaniesLoading(true)
      setCompaniesError(null)
      const res = await fetch('/api/owner/companies')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Не удалось загрузить компании')
      }
      const json = await res.json()
      setCompanies(json.companies || [])
    } catch (e: any) {
      setCompaniesError(e?.message || 'Ошибка загрузки компаний')
    } finally {
      setCompaniesLoading(false)
    }
  }

  const loadHealth = async () => {
    try {
      setHealthLoading(true)
      const [metricsRes, healthRes] = await Promise.all([
        fetch('/api/ops/metrics'),
        fetch('/api/ops/health'),
      ])
      if (metricsRes.ok) {
        setOpsMetrics((await metricsRes.json()) as OpsMetrics)
      }
      if (healthRes.ok) {
        setHealth(await healthRes.json())
      } else {
        setHealth({ ok: false })
      }
    } catch (e) {
      setHealth({ ok: false })
    } finally {
      setHealthLoading(false)
    }
  }

  const openDetails = async (companyId: number) => {
    try {
      setDetailsLoading(true)
      setDetailsOpen(true)
      const res = await fetch(`/api/owner/companies/${companyId}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Не удалось загрузить данные компании')
      }
      setDetails((await res.json()) as CompanyDetails)
    } catch (e: any) {
      console.error('[owner][company-details]', e)
      setDetails(null)
    } finally {
      setDetailsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'owner') {
      loadMetrics()
      loadCompanies()
      loadHealth()
    }
  }, [status, session])

  const totalCompanies = companies.length

  const companiesTable = useMemo(() => {
    if (companiesLoading) {
      return (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
          Загрузка компаний…
        </div>
      )
    }
    if (companiesError) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {companiesError}
        </div>
      )
    }
    if (companies.length === 0) {
      return (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
          Компании не найдены
        </div>
      )
    }

    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--background)] border-b border-[var(--border)]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Компания</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Тип</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Подписка</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Окончание</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Активных 10м</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Пользователей</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {companies.map((company) => {
                const sub = company.subscription
                const endDate = sub?.currentPeriodEnd || sub?.trialEndsAt || company.trialEndsAt
                return (
                  <tr key={company.id} className="hover:bg-[var(--background)] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-[var(--foreground)]">{company.name}</div>
                      {company.inn && (
                        <div className="text-xs text-[var(--muted)]">ИНН: {company.inn}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-[var(--foreground)]">{company.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        company.isLegalEntity ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {company.isLegalEntity ? 'Юр. лицо' : 'Физ. лицо'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-[var(--foreground)]">
                        {sub?.planName || 'Без плана'}
                      </div>
                      <div className="text-xs text-[var(--muted)]">{statusLabel(sub?.status)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground)]">
                      {formatDate(endDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground)]">
                      {company.activeUsers10m}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground)]">
                      {company.usersCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap flex flex-wrap gap-2">
                      <button
                        onClick={() => openDetails(company.id)}
                        className="btn-secondary text-xs px-3 py-1.5"
                      >
                        Данные и клиенты
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCompany({ id: company.id, name: company.name })
                          setExtendModalOpen(true)
                        }}
                        className="btn-primary text-xs px-3 py-1.5"
                      >
                        Продлить подписку
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 bg-[var(--background)] border-t border-[var(--border)] text-sm text-[var(--muted)]">
          Всего компаний: {totalCompanies}
        </div>
      </div>
    )
  }, [companies, companiesError, companiesLoading, totalCompanies])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Кабинет владельца</h1>
          <p className="text-[var(--muted)] text-sm">Управление компаниями и мониторинг системы.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadCompanies} className="btn-secondary" disabled={companiesLoading}>
            {companiesLoading ? 'Обновление…' : 'Обновить компании'}
          </button>
          <button onClick={loadMetrics} className="btn-secondary" disabled={metricsLoading}>
            {metricsLoading ? 'Обновление…' : 'Обновить метрики'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Компаний" value={metrics?.metrics?.companiesTotal ?? '—'} subtitle={`Новые 24ч: ${metrics?.metrics?.companies24h ?? '—'}`} />
        <MetricCard title="Пользователей" value={metrics?.metrics?.usersTotal ?? '—'} subtitle={`Активны 10м: ${metrics?.metrics?.activeUsers10m ?? '—'}`} />
        <MetricCard title="Подписок всего" value={metrics?.metrics?.subsTotal ?? '—'} subtitle={`Актив: ${metrics?.metrics?.subsActive ?? 0} • Trial: ${metrics?.metrics?.subsTrial ?? 0}`} />
        <MetricCard title="Контактов" value={metrics?.metrics?.contactsTotal ?? '—'} subtitle={`Сделок: ${metrics?.metrics?.dealsTotal ?? '—'}`} />
      </div>

      <div className="flex items-center gap-2 border-b border-[var(--border)]">
        <button
          onClick={() => setTab('companies')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'companies'
              ? 'border-[var(--primary)] text-[var(--primary)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
        >
          Компании
        </button>
        <button
          onClick={() => setTab('health')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'health'
              ? 'border-[var(--primary)] text-[var(--primary)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
        >
          Здоровье системы
        </button>
      </div>

      {tab === 'companies' ? (
        <div className="space-y-4">{companiesTable}</div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Здоровье системы</h2>
              <p className="text-[var(--muted)] text-sm">Сводка текущего состояния и активности.</p>
            </div>
            <button onClick={loadHealth} className="btn-secondary" disabled={healthLoading}>
              {healthLoading ? 'Обновление…' : 'Обновить'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title="База данных"
              value={opsMetrics?.dbOk ? 'OK' : 'Ошибка'}
              subtitle={
                opsMetrics
                  ? `t=${new Date(opsMetrics.timestamp).toLocaleTimeString()} · uptime=${Math.round(
                      (opsMetrics.uptimeSeconds ?? 0) / 60
                    )} мин`
                  : ''
              }
              status={opsMetrics?.dbOk ? 'ok' : 'warn'}
            />
            <MetricCard
              title="Активных 10м"
              value={opsMetrics?.metrics?.activeUsers10m ?? '—'}
              subtitle="По активности (logs)"
            />
            <MetricCard
              title="Health endpoint"
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
            <MetricCard
              title="Сделки 24ч"
              value={opsMetrics?.metrics?.dealsLast24h ?? '—'}
              subtitle={`Всего: ${opsMetrics?.metrics?.dealsTotal ?? '—'}`}
            />
            <MetricCard
              title="Контакты 24ч"
              value={opsMetrics?.metrics?.contactsLast24h ?? '—'}
              subtitle={`Всего: ${opsMetrics?.metrics?.contactsTotal ?? '—'}`}
            />
            <MetricCard
              title="Сабмиты форм 24ч"
              value={opsMetrics?.metrics?.submissionsLast24h ?? '—'}
              subtitle="WebForm submissions"
            />
          </div>
        </div>
      )}

      <Modal
        isOpen={detailsOpen}
        onClose={() => {
          setDetailsOpen(false)
          setDetails(null)
        }}
        title={details?.company?.name || 'Компания'}
        size="xl"
      >
        {detailsLoading ? (
          <div className="text-[var(--muted)]">Загрузка данных компании…</div>
        ) : details ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard title="ID компании" value={details.company.id} />
              <MetricCard title="Пользователей" value={details.stats.usersTotal} subtitle={`Активных 10м: ${details.stats.activeUsers10m}`} />
              <MetricCard title="Клиентов" value={details.stats.contactsTotal} subtitle={details.stats.contactsTotal > details.contactsLimit ? `Показаны последние ${details.contactsLimit}` : 'Полный список'} />
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2">
              <div className="text-sm text-[var(--muted)]">Регистрационные данные</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div><span className="text-[var(--muted)]">Название:</span> {details.company.name}</div>
                <div><span className="text-[var(--muted)]">Тип:</span> {details.company.isLegalEntity ? 'Юр. лицо' : 'Физ. лицо'}</div>
                <div><span className="text-[var(--muted)]">ИНН:</span> {details.company.inn || '—'}</div>
                <div><span className="text-[var(--muted)]">Создана:</span> {formatDate(details.company.createdAt)}</div>
                <div><span className="text-[var(--muted)]">Обновлена:</span> {formatDate(details.company.updatedAt)}</div>
                <div><span className="text-[var(--muted)]">Trial до:</span> {formatDate(details.company.trialEndsAt)}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2">
              <div className="text-sm text-[var(--muted)]">Подписка</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div><span className="text-[var(--muted)]">План:</span> {details.subscription?.planName || 'Без плана'}</div>
                <div><span className="text-[var(--muted)]">Статус:</span> {statusLabel(details.subscription?.status)}</div>
                <div><span className="text-[var(--muted)]">Биллинг:</span> {details.subscription?.billingInterval || '—'}</div>
                <div><span className="text-[var(--muted)]">Окончание:</span> {formatDate(details.subscription?.currentPeriodEnd || details.subscription?.trialEndsAt)}</div>
                <div><span className="text-[var(--muted)]">Cancel at period end:</span> {details.subscription?.cancelAtPeriodEnd ? 'Да' : 'Нет'}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
              <div className="text-sm text-[var(--muted)]">Пользователи компании</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                    <tr>
                      <th className="text-left py-2">Пользователь</th>
                      <th className="text-left py-2">Email</th>
                      <th className="text-left py-2">Роль</th>
                      <th className="text-left py-2">Создан</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {details.company.users.map((user) => (
                      <tr key={user.id}>
                        <td className="py-2">{user.name}</td>
                        <td className="py-2">{user.email}</td>
                        <td className="py-2">{user.role}</td>
                        <td className="py-2">{formatDate(user.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
              <div className="text-sm text-[var(--muted)]">Клиенты компании</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                    <tr>
                      <th className="text-left py-2">Клиент</th>
                      <th className="text-left py-2">Email</th>
                      <th className="text-left py-2">Телефон</th>
                      <th className="text-left py-2">Компания</th>
                      <th className="text-left py-2">ИНН</th>
                      <th className="text-left py-2">Менеджер</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {details.contacts.map((contact) => (
                      <tr key={contact.id}>
                        <td className="py-2">
                          <div className="font-medium">{contact.name}</div>
                          <div className="text-xs text-[var(--muted)]">{formatDate(contact.createdAt)}</div>
                        </td>
                        <td className="py-2">{contact.email || '—'}</td>
                        <td className="py-2">{contact.phone || '—'}</td>
                        <td className="py-2">{contact.company || '—'}</td>
                        <td className="py-2">{contact.inn || '—'}</td>
                        <td className="py-2 text-xs text-[var(--muted)]">
                          {contact.user?.name || '—'} {contact.user?.email ? `(${contact.user.email})` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {details.stats.contactsTotal > details.contactsLimit && (
                <div className="text-xs text-[var(--muted)]">
                  Показаны последние {details.contactsLimit} клиентов из {details.stats.contactsTotal}.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-[var(--muted)]">Нет данных</div>
        )}
      </Modal>

      {selectedCompany && (
        <ExtendSubscriptionModal
          isOpen={extendModalOpen}
          onClose={() => {
            setExtendModalOpen(false)
            setSelectedCompany(null)
          }}
          companyId={selectedCompany.id}
          companyName={selectedCompany.name}
          onSuccess={() => loadCompanies()}
        />
      )}
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
  const statusClasses =
    status === 'ok'
      ? 'border-emerald-200 bg-emerald-50'
      : status === 'warn'
      ? 'border-amber-200 bg-amber-50'
      : 'border-[var(--border)] bg-[var(--surface)]'

  return (
    <div className={`rounded-2xl border p-4 shadow-sm space-y-2 ${statusClasses}`}>
      <p className="text-sm text-[var(--muted)]">{title}</p>
      <div className="text-2xl font-semibold text-[var(--foreground)]">{value}</div>
      {subtitle && <p className="text-xs text-[var(--muted)]">{subtitle}</p>}
    </div>
  )
}

