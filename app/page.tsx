// app/page.tsx
'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import UserFilter from '@/components/UserFilter'
import Skeleton, { SkeletonKanban } from '@/components/Skeleton'
import { UsersIcon, CheckCircleIcon, BriefcaseIcon, CurrencyIcon } from '@/components/Icons'

interface Contact {
  id: number
  name: string
  email: string
  phone: string | null
  company: string | null
  createdAt: string
}

interface Task {
  id: number
  title: string
  status: string
  dueDate: string | null
}

interface Deal {
  id: number
  title: string
  amount: number
  currency: string
  stage: string
}

interface FunnelMetricMeta {
  id: string
  label: string
  color: string
  description: string
}

const DEFAULT_FUNNEL_METRICS = ['total', 'won-count', 'won-amount']

const FUNNEL_METRIC_META: FunnelMetricMeta[] = [
  {
    id: 'total',
    label: 'Всего сделок',
    color: 'from-blue-500 to-blue-600',
    description: 'Количество всех сделок в CRM'
  },
  {
    id: 'won-count',
    label: 'Выиграно',
    color: 'from-emerald-500 to-emerald-600',
    description: 'Сделки со статусом успешно закрыто'
  },
  {
    id: 'won-amount',
    label: 'Сумма выигрышей',
    color: 'from-purple-500 to-purple-600',
    description: 'Общая сумма выигранных сделок'
  },
  {
    id: 'active-count',
    label: 'Активные сделки',
    color: 'from-cyan-500 to-blue-500',
    description: 'Сделки, которые еще находятся в работе'
  },
  {
    id: 'open-amount',
    label: 'Портфель в работе',
    color: 'from-amber-500 to-orange-500',
    description: 'Сумма всех активных сделок'
  },
  {
    id: 'conversion',
    label: 'Конверсия, %',
    color: 'from-pink-500 to-rose-500',
    description: 'Доля выигранных сделок от общего количества'
  },
  {
    id: 'average-check',
    label: 'Средний чек',
    color: 'from-indigo-500 to-sky-500',
    description: 'Средняя сумма сделки'
  },
  {
    id: 'lost-count',
    label: 'Проиграно',
    color: 'from-red-500 to-orange-500',
    description: 'Количество проигранных или отмененных сделок'
  },
]

export default function Dashboard() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectedFunnelMetrics, setSelectedFunnelMetrics] = useState<string[]>(DEFAULT_FUNNEL_METRICS)
  const [isMetricsMenuOpen, setIsMetricsMenuOpen] = useState(false)
  const metricsMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    fetchData()
    // Проверяем просроченные задачи и предстоящие события при загрузке дашборда
    checkNotifications()
  }, [selectedUserId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem('dashboard_funnel_metrics')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length) {
          const validIds = parsed.filter((id: string) =>
            FUNNEL_METRIC_META.some((meta) => meta.id === id)
          )
          if (validIds.length) {
            setSelectedFunnelMetrics(validIds)
          }
        }
      } catch (error) {
        console.error('Error loading funnel metrics:', error)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('dashboard_funnel_metrics', JSON.stringify(selectedFunnelMetrics))
  }, [selectedFunnelMetrics])

  useEffect(() => {
    if (!isMetricsMenuOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (metricsMenuRef.current && !metricsMenuRef.current.contains(event.target as Node)) {
        setIsMetricsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMetricsMenuOpen])

  const checkNotifications = async () => {
    try {
      await fetch('/api/notifications/check', { method: 'POST' })
    } catch (error) {
      console.error('Error checking notifications:', error)
    }
  }

  const fetchData = async () => {
    try {
      const contactsUrl = selectedUserId 
        ? `/api/contacts?userId=${selectedUserId}` 
        : '/api/contacts'
      const tasksUrl = selectedUserId 
        ? `/api/tasks?userId=${selectedUserId}` 
        : '/api/tasks'
      const dealsUrl = selectedUserId 
        ? `/api/deals?userId=${selectedUserId}` 
        : '/api/deals'
      
      const [contactsRes, tasksRes, dealsRes] = await Promise.all([
        fetch(contactsUrl),
        fetch(tasksUrl),
        fetch(dealsUrl)
      ])
      
      // Проверяем статус ответов
      if (!contactsRes.ok) {
        console.error('Error fetching contacts:', contactsRes.statusText)
        setContacts([])
      } else {
        const contactsData = await contactsRes.json()
        setContacts(Array.isArray(contactsData) ? contactsData : [])
      }
      
      if (!tasksRes.ok) {
        console.error('Error fetching tasks:', tasksRes.statusText)
        setTasks([])
      } else {
        const tasksData = await tasksRes.json()
        setTasks(Array.isArray(tasksData) ? tasksData : [])
      }

      if (!dealsRes.ok) {
        console.error('Error fetching deals:', dealsRes.statusText)
        setDeals([])
      } else {
        const dealsData = await dealsRes.json()
        setDeals(Array.isArray(dealsData) ? dealsData : [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      setContacts([])
      setTasks([])
      setDeals([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card">
              <Skeleton variant="text" width="60%" height={12} className="mb-3" />
              <Skeleton variant="text" width="100%" height={32} className="mb-2" />
              <Skeleton variant="text" width="80%" height={12} />
            </div>
          ))}
        </div>
        <SkeletonKanban />
      </div>
    )
  }

  const pendingTasks = (tasks || []).filter(task => task.status === 'pending').length
  const overdueTasks = (tasks || []).filter(task => {
    if (task.status !== 'pending' || !task.dueDate) return false
    return new Date(task.dueDate) < new Date()
  }).length
  const recentContacts = (contacts || []).slice(0, 5)
  
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const newContactsCount = (contacts || []).filter(contact => new Date(contact.createdAt) >= weekAgo).length

  const handleMetricToggle = (metricId: string) => {
    setSelectedFunnelMetrics((prev) => {
      if (prev.includes(metricId)) {
        if (prev.length === 1) {
          return prev
        }
        return prev.filter((id) => id !== metricId)
      }
      return [...prev, metricId]
    })
  }

  const handleMetricsReset = () => {
    setSelectedFunnelMetrics([...DEFAULT_FUNNEL_METRICS])
  }

  // Вычисляем примитивные значения для зависимостей useMemo (без useMemo, чтобы избежать циклов)
  const dealsLength = (deals || []).length
  const dealsHash = !deals || deals.length === 0 
    ? '' 
    : deals.map(d => `${d.id}-${d.stage}-${d.amount}`).join('|')
  
  // Вычисляем все метрики внутри одного useMemo с примитивными зависимостями
  const { funnelMetricDefinitions, activeDealsCount, totalDealsAmount, wonAmount, openDealsAmount, conversionRate, averageDealAmount } = useMemo(() => {
    const dealsArr = deals || []
    const dealsLength = dealsArr.length
    
    if (!Array.isArray(dealsArr) || dealsLength === 0) {
      return {
        funnelMetricDefinitions: FUNNEL_METRIC_META.map((meta) => ({ ...meta, value: '—' })),
        activeDealsCount: 0,
        totalDealsAmount: 0,
        wonAmount: 0,
        openDealsAmount: 0,
        conversionRate: 0,
        averageDealAmount: 0
      }
    }
    
    // Вычисляем все метрики один раз
    const activeCount = dealsArr.filter(deal => !deal.stage.startsWith('closed_')).length
    const totalAmount = dealsArr.reduce((sum, deal) => sum + (deal.amount || 0), 0)
    const won = dealsArr.filter(deal => deal.stage === 'closed_won')
    const wonCount = won.length
    const wonAmt = won.reduce((sum, deal) => sum + (deal.amount || 0), 0)
    const openAmt = dealsArr
      .filter(deal => !deal.stage.startsWith('closed_'))
      .reduce((sum, deal) => sum + (deal.amount || 0), 0)
    const lost = dealsArr.filter(deal => deal.stage.startsWith('closed_') && deal.stage !== 'closed_won')
    const lostCount = lost.length
    const convRate = dealsLength ? Math.round((wonCount / dealsLength) * 100) : 0
    const avgAmount = dealsLength ? Math.round(totalAmount / dealsLength) : 0
    
    const formatNumber = (value: number) => value.toLocaleString('ru-RU')
    const formatCurrency = (value: number) => `${value.toLocaleString('ru-RU')} ₽`
    
    const definitions = FUNNEL_METRIC_META.map((meta) => {
      let value = '—'
      try {
        switch (meta.id) {
          case 'total':
            value = formatNumber(dealsLength)
            break
          case 'won-count':
            value = formatNumber(wonCount)
            break
          case 'won-amount':
            value = formatCurrency(wonAmt)
            break
          case 'active-count':
            value = formatNumber(activeCount)
            break
          case 'open-amount':
            value = formatCurrency(openAmt)
            break
          case 'conversion':
            value = `${convRate}%`
            break
          case 'average-check':
            value = dealsLength ? formatCurrency(avgAmount) : '—'
            break
          case 'lost-count':
            value = formatNumber(lostCount)
            break
          default:
            value = '—'
        }
      } catch (error) {
        console.error(`Error calculating metric ${meta.id}:`, error)
        value = '—'
      }
      return { ...meta, value }
    })
    
    return {
      funnelMetricDefinitions: definitions,
      activeDealsCount: activeCount,
      totalDealsAmount: totalAmount,
      wonAmount: wonAmt,
      openDealsAmount: openAmt,
      conversionRate: convRate,
      averageDealAmount: avgAmount
    }
  }, [dealsLength, dealsHash])

  const metricsToDisplay = useMemo(() => {
    const filtered = funnelMetricDefinitions.filter((metric) =>
      selectedFunnelMetrics.includes(metric.id)
    )
    if (filtered.length) {
      return filtered
    }
    return funnelMetricDefinitions.filter((metric) =>
      DEFAULT_FUNNEL_METRICS.includes(metric.id)
    )
  }, [funnelMetricDefinitions, selectedFunnelMetrics])

  return (
    <div className="space-y-8">
      <div className="glass-panel px-6 py-5 rounded-3xl">
        <UserFilter 
          selectedUserId={selectedUserId} 
          onUserChange={setSelectedUserId} 
        />
      </div>
      
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[
          { 
            label: 'Клиенты', 
            value: contacts.length, 
            Icon: UsersIcon, 
            note: `+${newContactsCount} за 7 дней`, 
            accent: 'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600',
            gradient: 'from-blue-500 to-blue-600'
          },
          { 
            label: 'Активные задачи', 
            value: pendingTasks, 
            Icon: CheckCircleIcon, 
            note: overdueTasks ? `${overdueTasks} просрочено` : 'Без просрочки', 
            accent: 'bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600',
            gradient: 'from-amber-500 to-amber-600'
          },
          { 
            label: 'Активные сделки', 
            value: activeDealsCount, 
            Icon: BriefcaseIcon, 
            note: `${openDealsAmount.toLocaleString('ru-RU')} ₽ в работе`, 
            accent: 'bg-gradient-to-br from-purple-50 to-purple-100 text-purple-600',
            gradient: 'from-purple-500 to-purple-600'
          },
          { 
            label: 'Выручка', 
            value: `${totalDealsAmount.toLocaleString('ru-RU')} ₽`, 
            Icon: CurrencyIcon, 
            note: `${wonAmount.toLocaleString('ru-RU')} ₽ выиграно`, 
            accent: 'bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600',
            gradient: 'from-emerald-500 to-emerald-600'
          },
        ].map((card) => (
          <div key={card.label} className="stat-card flex items-center justify-between gap-4 group">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)] font-bold mb-2">{card.label}</p>
              <p className="stat-card-value mb-1 group-hover:scale-105 transition-transform duration-300">{card.value}</p>
              <p className="text-sm text-[var(--muted)] font-medium">{card.note}</p>
            </div>
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300 ${card.accent}`}>
              <card.Icon className="w-7 h-7" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="glass-panel rounded-3xl p-6 space-y-6 lg:col-span-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)] font-bold mb-1">Сделки</p>
              <h2 className="text-2xl font-bold text-[var(--foreground)] bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] bg-clip-text text-transparent">Срез по воронке</h2>
            </div>
            <div className="relative" ref={metricsMenuRef}>
              <button
                onClick={() => setIsMetricsMenuOpen((prev) => !prev)}
                className="btn-secondary text-xs lg:text-sm flex items-center gap-1.5 px-3 py-2 whitespace-nowrap"
              >
                <span>⚙️</span>
                <span>Настроить показатели</span>
              </button>
              {isMetricsMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-lg p-4 space-y-3 z-50">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[var(--foreground)]">Какие показатели показывать?</p>
                    <button
                      className="text-xs text-[var(--primary)]"
                      onClick={handleMetricsReset}
                    >
                      Сбросить
                    </button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {funnelMetricDefinitions.map((metric) => {
                      const checked = selectedFunnelMetrics.includes(metric.id)
                      const disableUncheck = checked && selectedFunnelMetrics.length === 1
                      return (
                        <label
                          key={metric.id}
                          className="flex items-start gap-2 text-sm cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            className="mt-1 accent-[var(--primary)]"
                            checked={checked}
                            disabled={disableUncheck}
                            onChange={() => handleMetricToggle(metric.id)}
                          />
                          <div>
                            <p className="font-medium text-[var(--foreground)]">{metric.label}</p>
                            <p className="text-xs text-[var(--muted)]">{metric.description}</p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                  <p className="text-[10px] text-[var(--muted)]">Минимум один показатель должен быть выбран</p>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {metricsToDisplay.map((metric) => (
              <div key={metric.id} className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--panel-muted)] to-[var(--surface)] p-5 hover:shadow-md transition-all duration-300 group">
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)] font-bold mb-3">{metric.label}</p>
                <p className={`text-3xl font-bold bg-gradient-to-r ${metric.color} bg-clip-text text-transparent group-hover:scale-105 transition-transform duration-300`}>{metric.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5 bg-gradient-to-r from-[var(--background-soft)] to-transparent">
            <div>
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)] font-bold mb-1">Клиенты</p>
              <h2 className="text-xl font-bold text-[var(--foreground)]">Последние контакты</h2>
            </div>
            <span className="text-xs font-semibold text-[var(--muted)] bg-[var(--background-soft)] px-3 py-1 rounded-full">{recentContacts.length} записей</span>
          </div>
          <div>
            {recentContacts.length === 0 ? (
              <div className="empty-state py-12">
                <div className="empty-state-icon flex items-center justify-center">
                  <UsersIcon className="w-16 h-16 text-[var(--muted-soft)]" />
                </div>
                <h3 className="empty-state-title">Нет контактов</h3>
                <p className="empty-state-description">
                  Пока нет клиентов — импортируйте контакты или добавьте вручную.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-soft)]">
                {recentContacts.map((contact, index) => (
                  <div key={contact.id} className="px-6 py-4 hover:bg-[var(--background-soft)] transition-colors duration-200 group">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--primary-soft)] to-[var(--primary)] flex items-center justify-center text-[var(--primary)] font-bold text-sm shadow-sm group-hover:scale-110 transition-transform duration-300">
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[var(--foreground)] truncate">{contact.name}</p>
                            <p className="text-xs text-[var(--muted)] truncate">{contact.email}</p>
                          </div>
                        </div>
                        <p className="text-sm text-[var(--muted)] ml-[52px]">{contact.company || '—'}</p>
                      </div>
                      <span className="text-xs text-[var(--muted)] font-medium whitespace-nowrap">
                        {new Date(contact.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}