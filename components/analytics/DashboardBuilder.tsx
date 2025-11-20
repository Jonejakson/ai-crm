'use client'

import { useState, useEffect, useMemo, ReactNode } from 'react'
import {
  DndContext,
  DragEndEvent,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type WidgetId =
  | 'kpi'
  | 'chart'
  | 'pipeline'
  | 'managers'
  | 'tasks'
  | 'forecast'
  | 'events'

interface AnalyticsData {
  period: string
  contacts: {
    total: number
    newThisPeriod: number
    withDeals: number
  }
  tasks: {
    total: number
    pending: number
    completed: number
    overdue: number
    newThisPeriod: number
  }
  deals: {
    total: number
    active: number
    won: number
    lost: number
    totalAmount: number
    wonAmount: number
    lostAmount: number
    newThisPeriod: number
    byStage: Record<string, number>
  }
  events: {
    total: number
    upcoming: number
    past: number
    byType: Record<string, number>
    newThisPeriod: number
  }
  chartData: Array<{
    date: string
    index: number
    contacts: number
    tasks: number
    deals: number
    events: number
    wonAmount: number
  }>
  managerPerformance: Array<{
    userId: number
    name: string
    email: string
    totalDeals: number
    wonDeals: number
    revenue: number
    conversion: number
  }>
  pipelineSummary: Array<{
    stage: string
    count: number
    share: number
  }>
  kpi: {
    revenue: { plan: number; fact: number }
    deals: { plan: number; fact: number }
    tasks: { plan: number; fact: number }
  }
  forecast: {
    trendPerDay: number
    next30DaysTotal: number
    projection: Array<{ date: string; value: number }>
  }
}

interface WidgetDefinition {
  id: WidgetId
  title: string
  description: string
  render: (data: AnalyticsData) => ReactNode
}

const DEFAULT_WIDGETS: WidgetId[] = ['kpi', 'chart', 'pipeline', 'managers', 'tasks', 'forecast', 'events']

const WIDGETS: Record<WidgetId, WidgetDefinition> = {
  kpi: {
    id: 'kpi',
    title: 'KPI и план/факт',
    description: 'Выручка, сделки и задачи относительно цели',
    render: (data) => <KPIWidget data={data} />,
  },
  chart: {
    id: 'chart',
    title: 'Многомерный график',
    description: 'Контакты, задачи, сделки и события по дням',
    render: (data) => <MultiMetricChart data={data.chartData} period={data.period} />,
  },
  pipeline: {
    id: 'pipeline',
    title: 'Воронка продаж',
    description: 'Структура воронки и доли этапов',
    render: (data) => <PipelineWidget stages={data.pipelineSummary} total={data.deals.total} />,
  },
  managers: {
    id: 'managers',
    title: 'Рейтинг менеджеров',
    description: 'Выручка и конверсия по сотрудникам',
    render: (data) => <ManagerWidget rows={data.managerPerformance} />,
  },
  tasks: {
    id: 'tasks',
    title: 'Операционная нагрузка',
    description: 'Баланс выполненных, активных и просроченных задач',
    render: (data) => <TasksWidget stats={data.tasks} />,
  },
  forecast: {
    id: 'forecast',
    title: 'ML-прогноз выручки',
    description: 'Прогноз на 30 дней по тренду выигранных сделок',
    render: (data) => <ForecastWidget forecast={data.forecast} />,
  },
  events: {
    id: 'events',
    title: 'Активность',
    description: 'Структура звонков, встреч и событий',
    render: (data) => <EventsWidget stats={data.events} />,
  },
}

interface DashboardBuilderProps {
  data: AnalyticsData
}

export default function DashboardBuilder({ data }: DashboardBuilderProps) {
  const [activeWidgets, setActiveWidgets] = useState<WidgetId[]>(DEFAULT_WIDGETS)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('analytics-widgets') : null
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as WidgetId[]
        setActiveWidgets(parsed.filter((id) => id in WIDGETS))
      } catch {
        setActiveWidgets(DEFAULT_WIDGETS)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('analytics-widgets', JSON.stringify(activeWidgets))
    }
  }, [activeWidgets])

  const availableWidgets = useMemo(
    () => (Object.keys(WIDGETS) as WidgetId[]).filter((id) => !activeWidgets.includes(id)),
    [activeWidgets]
  )

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setActiveWidgets((prev) => {
      const oldIndex = prev.indexOf(active.id as WidgetId)
      const newIndex = prev.indexOf(over.id as WidgetId)
      if (oldIndex === -1 || newIndex === -1) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  const addWidget = (widgetId: WidgetId) => {
    setActiveWidgets((prev) => [...prev, widgetId])
  }

  const removeWidget = (widgetId: WidgetId) => {
    setActiveWidgets((prev) => prev.filter((id) => id !== widgetId))
  }

  const resetLayout = () => {
    setResetting(true)
    setActiveWidgets(DEFAULT_WIDGETS)
    setTimeout(() => setResetting(false), 200)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Конструктор дашборда</h2>
          <p className="text-sm text-[var(--muted)]">Перетаскивайте виджеты для настройки макета</p>
        </div>
        <button className="btn-secondary" onClick={resetLayout}>
          ♻️ Сбросить макет
        </button>
      </div>

      {availableWidgets.length > 0 && (
        <div className="glass-panel rounded-3xl p-5">
          <p className="text-xs uppercase text-slate-400 tracking-[0.3em] mb-3">Доступные виджеты</p>
          <div className="flex flex-wrap gap-3">
            {availableWidgets.map((widgetId) => (
              <button
                key={widgetId}
                className="btn-secondary text-sm"
                onClick={() => addWidget(widgetId)}
              >
                + {WIDGETS[widgetId].title}
              </button>
            ))}
          </div>
        </div>
      )}

      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={activeWidgets} strategy={verticalListSortingStrategy}>
          <div className={`space-y-6 transition-opacity ${resetting ? 'opacity-40' : 'opacity-100'}`}>
            {activeWidgets.map((widgetId) => (
              <SortableWidgetCard key={widgetId} widgetId={widgetId} title={WIDGETS[widgetId].title}>
                <WidgetCard
                  widget={WIDGETS[widgetId]}
                  data={data}
                  onRemove={() => removeWidget(widgetId)}
                />
              </SortableWidgetCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

function SortableWidgetCard({
  widgetId,
  title,
  children,
}: {
  widgetId: WidgetId
  title: string
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: widgetId })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div className="glass-panel rounded-3xl p-6">
        <div className="flex items-center justify-between border-b border-white/40 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <button
              className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing"
              aria-label="Переместить"
              {...listeners}
              {...attributes}
            >
              ⋮⋮
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Виджет</p>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function WidgetCard({
  widget,
  data,
  onRemove,
}: {
  widget: WidgetDefinition
  data: AnalyticsData
  onRemove: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">{widget.description}</p>
        <button onClick={onRemove} className="text-[var(--muted)] hover:text-red-500 text-sm">
          Удалить
        </button>
      </div>
      {widget.render(data)}
    </div>
  )
}

function KPIWidget({ data }: { data: AnalyticsData }) {
  const items = [
    { label: 'Выручка', plan: data.kpi.revenue.plan, fact: data.kpi.revenue.fact, icon: '💰' },
    { label: 'Сделки', plan: data.kpi.deals.plan, fact: data.kpi.deals.fact, icon: '📈' },
    { label: 'Задачи', plan: data.kpi.tasks.plan, fact: data.kpi.tasks.fact, icon: '✅' },
  ]
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {items.map((item) => {
        const progress = item.plan > 0 ? Math.min((item.fact / item.plan) * 100, 150) : 0
        return (
          <div key={item.label} className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{item.label}</p>
                <p className="text-2xl font-bold text-[var(--foreground)]">{formatCurrency(item.fact)}</p>
              </div>
              <div className="text-3xl">{item.icon}</div>
            </div>
            <div className="text-sm text-[var(--muted)] mb-2">План: {formatCurrency(item.plan)}</div>
            <div className="h-2 rounded-full bg-white/40 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)]"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="text-xs text-[var(--muted)] mt-1">
              {progress >= 100 ? 'Цель выполнена' : `Осталось ${formatCurrency(Math.max(item.plan - item.fact, 0))}`}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MultiMetricChart({ data, period }: { data: any[]; period: string }) {
  const chartHeight = 240
  const chartPadding = { top: 20, right: 20, bottom: 40, left: 50 }
  const chartWidth = Math.max(600, data.length * 28)
  const maxValue = Math.max(
    1,
    ...data.flatMap((point) => [point.contacts, point.tasks, point.deals, point.events])
  )

  const getX = (index: number) => {
    if (data.length <= 1) {
      return chartPadding.left + (chartWidth - chartPadding.left - chartPadding.right) / 2
    }
    return chartPadding.left + (index / (data.length - 1)) * (chartWidth - chartPadding.left - chartPadding.right)
  }

  const getY = (value: number) => {
    const normalized = value / maxValue
    return chartHeight - chartPadding.bottom - normalized * (chartHeight - chartPadding.top - chartPadding.bottom)
  }

  const path = (values: number[]) =>
    values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${getX(index)} ${getY(value)}`).join(' ')

  return (
    <div className="overflow-x-auto">
      <svg width={chartWidth} height={chartHeight + 30} className="w-full">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = chartPadding.top + (chartHeight - chartPadding.top - chartPadding.bottom) * (1 - ratio)
          return (
            <g key={ratio}>
              <line
                x1={chartPadding.left}
                y1={y}
                x2={chartWidth - chartPadding.right}
                y2={y}
                stroke="#e5e7eb"
                strokeDasharray="4 4"
              />
              <text x={chartPadding.left - 10} y={y + 4} textAnchor="end" fontSize={10} fill="#94a3b8">
                {Math.round(maxValue * ratio)}
              </text>
            </g>
          )
        })}

        <path d={path(data.map((d) => d.contacts))} fill="none" stroke="#3b82f6" strokeWidth={2.5} />
        <path d={path(data.map((d) => d.tasks))} fill="none" stroke="#f97316" strokeWidth={2.5} />
        <path d={path(data.map((d) => d.deals))} fill="none" stroke="#a855f7" strokeWidth={2.5} />
        <path d={path(data.map((d) => d.events))} fill="none" stroke="#10b981" strokeWidth={2.5} />

        {data.map((point, index) => (
          <text
            key={point.date}
            x={getX(index)}
            y={chartHeight + 20}
            textAnchor="middle"
            fontSize={10}
            fill="#94a3b8"
          >
            {new Date(point.date).toLocaleDateString('ru-RU', {
              month: period === 'year' ? 'short' : 'numeric',
              day: 'numeric',
            })}
          </text>
        ))}
      </svg>
    </div>
  )
}

function PipelineWidget({ stages, total }: { stages: any[]; total: number }) {
  return (
    <div className="space-y-3">
      {stages.map((stage) => (
        <div key={stage.stage} className="space-y-1">
          <div className="flex items-center justify-between text-sm text-[var(--muted)]">
            <span>{getStageName(stage.stage)}</span>
            <span>
              {stage.count} / {total > 0 ? stage.share.toFixed(1) : 0}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/40">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)]"
              style={{ width: `${Math.min(stage.share, 100)}%` }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ManagerWidget({ rows }: { rows: any[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Нет данных по менеджерам</p>
  }
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.userId} className="flex items-center justify-between rounded-2xl border border-white/40 p-4">
          <div>
            <p className="font-semibold text-[var(--foreground)]">{row.name}</p>
            <p className="text-xs text-[var(--muted)]">{row.email}</p>
          </div>
          <div className="text-right text-sm">
            <p className="text-[var(--primary)] font-semibold">{formatCurrency(row.revenue)}</p>
            <p className="text-[var(--muted)]">Конверсия: {row.conversion.toFixed(1)}%</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function TasksWidget({ stats }: { stats: any }) {
  const segments = [
    { label: 'В работе', value: stats.pending, color: 'from-orange-500/80 to-amber-500/80' },
    { label: 'Завершено', value: stats.completed, color: 'from-emerald-500/80 to-teal-500/80' },
    { label: 'Просрочено', value: stats.overdue, color: 'from-rose-500/80 to-red-500/80' },
  ]
  return (
    <div className="space-y-3">
      {segments.map((segment) => (
        <div key={segment.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm text-[var(--muted)]">
            <span>{segment.label}</span>
            <span>{segment.value}</span>
          </div>
          <div className="h-2 rounded-full bg-white/40 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${segment.color}`}
              style={{ width: `${stats.total ? Math.min((segment.value / stats.total) * 100, 100) : 0}%` }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ForecastWidget({ forecast }: { forecast: any }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Тренд в день</p>
          <p className="text-2xl font-semibold text-[var(--foreground)]">{formatCurrency(forecast.trendPerDay)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">30 дней</p>
          <p className="text-2xl font-semibold text-[var(--foreground)]">{formatCurrency(forecast.next30DaysTotal)}</p>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto text-xs text-[var(--muted)]">
        {forecast.projection.slice(0, 10).map((point: any) => (
          <div key={point.date} className="min-w-[80px] rounded-xl bg-white/50 p-3">
            <p className="font-semibold text-[var(--foreground)]">{formatCurrency(point.value)}</p>
            <p>{new Date(point.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function EventsWidget({ stats }: { stats: any }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-[var(--primary-soft)]/40 p-3 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Предстоящие</p>
          <p className="text-xl font-semibold text-[var(--primary)]">{stats.upcoming}</p>
        </div>
        <div className="rounded-2xl bg-[var(--background-soft)] p-3 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Прошедшие</p>
          <p className="text-xl font-semibold text-[var(--foreground)]">{stats.past}</p>
        </div>
      </div>
      <div className="space-y-2">
        {Object.entries(stats.byType).map(([type, count]: [string, any]) => (
          <div key={type} className="flex items-center justify-between rounded-xl border border-white/40 px-4 py-2 text-sm">
            <span>{getTypeName(type)}</span>
            <span className="font-semibold">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const stageNameMap: Record<string, string> = {
  lead: 'Лид',
  qualification: 'Квалификация',
  proposal: 'Предложение',
  negotiation: 'Переговоры',
  closed_won: 'Закрыта (успех)',
  closed_lost: 'Закрыта (провал)',
}

function getStageName(value: string) {
  return stageNameMap[value] || value
}

const typeNameMap: Record<string, string> = {
  meeting: 'Встреча',
  call: 'Звонок',
  task: 'Задача',
  other: 'Другое',
}

function getTypeName(value: string) {
  return typeNameMap[value] || value
}

function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`
}

