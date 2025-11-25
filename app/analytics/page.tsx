'use client'

import { useState, useEffect } from 'react'
import UserFilter from '@/components/UserFilter'
import AnalyticsTabs from '@/components/analytics/AnalyticsTabs'

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
    contacts: number
    tasks: number
    deals: number
    events: number
  }>
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month')
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null)
  const [pipelines, setPipelines] = useState<Array<{ id: number; name: string }>>([])

  useEffect(() => {
    fetchAnalytics()
    fetchPipelines()
  }, [period, selectedUserId])

  const fetchPipelines = async () => {
    try {
      const response = await fetch('/api/pipelines')
      if (response.ok) {
        const data = await response.json()
        setPipelines(data || [])
      }
    } catch (error) {
      console.error('Error fetching pipelines:', error)
    }
  }

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const url = selectedUserId 
        ? `/api/analytics?period=${period}&userId=${selectedUserId}` 
        : `/api/analytics?period=${period}`
      const response = await fetch(url)
      if (response.ok) {
        const analyticsData = await response.json()
        setData(analyticsData)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStageName = (stage: string): string => {
    const names: Record<string, string> = {
      lead: 'Лид',
      qualification: 'Квалификация',
      proposal: 'Предложение',
      negotiation: 'Переговоры',
      closed_won: 'Закрыта (Успех)',
      closed_lost: 'Закрыта (Провал)',
    }
    return names[stage] || stage
  }

  const getTypeName = (type: string): string => {
    const names: Record<string, string> = {
      meeting: 'Встреча',
      call: 'Звонок',
      task: 'Задача',
      other: 'Другое',
    }
    return names[type] || type
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-[var(--muted)]">Загрузка аналитики...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⚠️</div>
        <h3 className="empty-state-title">Ошибка загрузки данных</h3>
        <p className="empty-state-description">
          Не удалось загрузить данные аналитики. Попробуйте обновить страницу.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Заголовок */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Аналитика</p>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Отчеты и статистика</h1>
          <p className="text-sm text-[var(--muted)]">Анализ эффективности работы и продаж</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative group">
            <button className="btn-secondary flex items-center gap-2">
              📊 Экспорт сделок
            </button>
            <div className="absolute top-full left-0 mt-1 hidden group-hover:block bg-white border border-[var(--border)] rounded-xl shadow-lg p-2 z-10 min-w-[200px]">
              <a
                href={`/api/analytics/export?type=deals&period=${period}&format=csv`}
                className="block px-3 py-2 hover:bg-[var(--background-soft)] rounded-lg text-sm"
              >
                📄 CSV
              </a>
              <a
                href={`/api/analytics/export?type=deals&period=${period}&format=xlsx`}
                className="block px-3 py-2 hover:bg-[var(--background-soft)] rounded-lg text-sm"
              >
                📊 Excel
              </a>
              <a
                href={`/api/analytics/export?type=deals&period=${period}&format=pdf`}
                className="block px-3 py-2 hover:bg-[var(--background-soft)] rounded-lg text-sm"
              >
                📑 PDF
              </a>
            </div>
          </div>
          <div className="relative group">
            <button className="btn-secondary flex items-center gap-2">
              📋 Экспорт задач
            </button>
            <div className="absolute top-full left-0 mt-1 hidden group-hover:block bg-white border border-[var(--border)] rounded-xl shadow-lg p-2 z-10 min-w-[200px]">
              <a
                href={`/api/analytics/export?type=tasks&period=${period}&format=csv`}
                className="block px-3 py-2 hover:bg-[var(--background-soft)] rounded-lg text-sm"
              >
                📄 CSV
              </a>
              <a
                href={`/api/analytics/export?type=tasks&period=${period}&format=xlsx`}
                className="block px-3 py-2 hover:bg-[var(--background-soft)] rounded-lg text-sm"
              >
                📊 Excel
              </a>
              <a
                href={`/api/analytics/export?type=tasks&period=${period}&format=pdf`}
                className="block px-3 py-2 hover:bg-[var(--background-soft)] rounded-lg text-sm"
              >
                📑 PDF
              </a>
            </div>
          </div>
          <div className="relative group">
            <button className="btn-secondary flex items-center gap-2">
              👥 Экспорт контактов
            </button>
            <div className="absolute top-full left-0 mt-1 hidden group-hover:block bg-white border border-[var(--border)] rounded-xl shadow-lg p-2 z-10 min-w-[200px]">
              <a
                href={`/api/analytics/export?type=contacts&period=${period}&format=csv`}
                className="block px-3 py-2 hover:bg-[var(--background-soft)] rounded-lg text-sm"
              >
                📄 CSV
              </a>
              <a
                href={`/api/analytics/export?type=contacts&period=${period}&format=xlsx`}
                className="block px-3 py-2 hover:bg-[var(--background-soft)] rounded-lg text-sm"
              >
                📊 Excel
              </a>
              <a
                href={`/api/analytics/export?type=contacts&period=${period}&format=pdf`}
                className="block px-3 py-2 hover:bg-[var(--background-soft)] rounded-lg text-sm"
              >
                📑 PDF
              </a>
            </div>
          </div>
          <div className="relative group">
            <button className="btn-secondary flex items-center gap-2">
              👔 Экспорт менеджеров
            </button>
            <div className="absolute top-full left-0 mt-1 hidden group-hover:block bg-white border border-[var(--border)] rounded-xl shadow-lg p-2 z-10 min-w-[200px]">
              <a
                href={`/api/analytics/export?type=managers&period=${period}&format=csv`}
                className="block px-3 py-2 hover:bg-[var(--background-soft)] rounded-lg text-sm"
              >
                📄 CSV
              </a>
              <a
                href={`/api/analytics/export?type=managers&period=${period}&format=xlsx`}
                className="block px-3 py-2 hover:bg-[var(--background-soft)] rounded-lg text-sm"
              >
                📊 Excel
              </a>
              <a
                href={`/api/analytics/export?type=managers&period=${period}&format=pdf`}
                className="block px-3 py-2 hover:bg-[var(--background-soft)] rounded-lg text-sm"
              >
                📑 PDF
              </a>
            </div>
          </div>
        </div>
      </div>
      
      {/* Фильтры */}
      <div className="glass-panel px-6 py-5 rounded-3xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1 lg:max-w-md">
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] mb-2">
              Менеджер
            </label>
            <UserFilter 
              selectedUserId={selectedUserId} 
              onUserChange={setSelectedUserId} 
            />
          </div>
          <div className="flex-1 lg:max-w-md">
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] mb-2">
              Воронка
            </label>
            <select
              value={selectedPipelineId || ''}
              onChange={(e) => setSelectedPipelineId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
            >
              <option value="">Все воронки</option>
              {pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Период */}
      <div className="glass-panel p-6 rounded-3xl">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setPeriod('week')}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              period === 'week' 
                ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-lg' 
                : 'bg-white text-[var(--muted)] border border-[var(--border)] hover:border-[var(--primary)]'
            }`}
          >
            Неделя
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              period === 'month' 
                ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-lg' 
                : 'bg-white text-[var(--muted)] border border-[var(--border)] hover:border-[var(--primary)]'
            }`}
          >
            Месяц
          </button>
          <button
            onClick={() => setPeriod('year')}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              period === 'year' 
                ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-lg' 
                : 'bg-white text-[var(--muted)] border border-[var(--border)] hover:border-[var(--primary)]'
            }`}
          >
            Год
          </button>
        </div>
      </div>

      {/* Основная статистика */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {[
          { 
            label: 'Всего клиентов', 
            value: data.contacts.total, 
            icon: '👥', 
            gradient: 'from-blue-500 to-cyan-500', 
            bg: 'bg-blue-50',
            subtitle: `Новых за период: +${data.contacts.newThisPeriod}`
          },
          { 
            label: 'Активные задачи', 
            value: data.tasks.pending, 
            icon: '✅', 
            gradient: 'from-orange-500 to-amber-500', 
            bg: 'bg-orange-50',
            subtitle: `Просрочено: ${data.tasks.overdue}`
          },
          { 
            label: 'Активные сделки', 
            value: data.deals.active, 
            icon: '💰', 
            gradient: 'from-purple-500 to-pink-500', 
            bg: 'bg-purple-50',
            subtitle: `Всего: ${data.deals.total}`
          },
          { 
            label: 'Сумма сделок', 
            value: `${data.deals.totalAmount.toLocaleString('ru-RU')} ₽`, 
            icon: '💵', 
            gradient: 'from-emerald-500 to-teal-500', 
            bg: 'bg-emerald-50',
            subtitle: `Выручка: ${data.deals.wonAmount.toLocaleString('ru-RU')} ₽`
          },
        ].map((card) => (
          <div key={card.label} className="stat-card group relative overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
            <div className="relative flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] font-semibold mb-2">{card.label}</p>
                <p className={`stat-card-value bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent`}>
                  {card.value}
                </p>
                <p className="text-sm text-[var(--muted)] mt-1">{card.subtitle}</p>
              </div>
              <div className={`rounded-2xl ${card.bg} p-4 text-3xl shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Разделы аналитики */}
      <AnalyticsTabs 
        period={period}
        selectedUserId={selectedUserId}
        selectedPipelineId={selectedPipelineId}
        analyticsData={data}
        chartData={data.chartData}
      />

      {/* Детальная статистика */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Статистика по сделкам */}
        <div className="glass-panel rounded-3xl">
          <div className="p-6 border-b border-white/40">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Сделки</p>
            <h2 className="text-xl font-semibold text-slate-900 mt-1">Статистика по сделкам</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--success-soft)]/30">
                <span className="text-[var(--muted)] font-medium">Закрыто успешно:</span>
                <span className="font-semibold text-[var(--success)]">
                  {data.deals.won} ({data.deals.wonAmount.toLocaleString('ru-RU')} ₽)
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--error-soft)]/30">
                <span className="text-[var(--muted)] font-medium">Закрыто и не реализовано:</span>
                <span className="font-semibold text-[var(--error)]">
                  {data.deals.lost} ({data.deals.lostAmount.toLocaleString('ru-RU')} ₽)
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--primary-soft)]/30">
                <span className="text-[var(--muted)] font-medium">Конверсия:</span>
                <span className="font-semibold text-[var(--primary)]">
                  {data.deals.total > 0 
                    ? ((data.deals.won / data.deals.total) * 100).toFixed(1) 
                    : 0}%
                </span>
              </div>
              <div className="mt-4 pt-4 border-t border-white/40">
                <h3 className="font-semibold text-[var(--foreground)] mb-3">По этапам:</h3>
                <div className="space-y-2">
                  {Object.entries(data.deals.byStage).map(([stage, count]) => (
                    <div key={stage} className="flex justify-between items-center p-2 rounded-lg hover:bg-white/50 transition-colors">
                      <span className="text-sm text-[var(--muted)]">{getStageName(stage)}:</span>
                      <span className="text-sm font-semibold text-[var(--foreground)]">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Статистика по задачам */}
        <div className="glass-panel rounded-3xl">
          <div className="p-6 border-b border-white/40">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Задачи</p>
            <h2 className="text-xl font-semibold text-slate-900 mt-1">Статистика по задачам</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-xl bg-white/50">
                <span className="text-[var(--muted)] font-medium">Всего:</span>
                <span className="font-semibold text-[var(--foreground)]">{data.tasks.total}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--warning-soft)]/30">
                <span className="text-[var(--muted)] font-medium">В работе:</span>
                <span className="font-semibold text-[var(--warning)]">{data.tasks.pending}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--success-soft)]/30">
                <span className="text-[var(--muted)] font-medium">Завершено:</span>
                <span className="font-semibold text-[var(--success)]">{data.tasks.completed}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--error-soft)]/30">
                <span className="text-[var(--muted)] font-medium">Просрочено:</span>
                <span className="font-semibold text-[var(--error)]">{data.tasks.overdue}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--primary-soft)]/30">
                <span className="text-[var(--muted)] font-medium">Выполнение:</span>
                <span className="font-semibold text-[var(--primary)]">
                  {data.tasks.total > 0 
                    ? ((data.tasks.completed / data.tasks.total) * 100).toFixed(1) 
                    : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Статистика по событиям */}
        <div className="glass-panel rounded-3xl">
          <div className="p-6 border-b border-white/40">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">События</p>
            <h2 className="text-xl font-semibold text-slate-900 mt-1">Статистика по событиям</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-xl bg-white/50">
                <span className="text-[var(--muted)] font-medium">Всего:</span>
                <span className="font-semibold text-[var(--foreground)]">{data.events.total}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--primary-soft)]/30">
                <span className="text-[var(--muted)] font-medium">Предстоящие:</span>
                <span className="font-semibold text-[var(--primary)]">{data.events.upcoming}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--background-soft)]">
                <span className="text-[var(--muted)] font-medium">Прошедшие:</span>
                <span className="font-semibold text-[var(--muted)]">{data.events.past}</span>
              </div>
              <div className="mt-4 pt-4 border-t border-white/40">
                <h3 className="font-semibold text-[var(--foreground)] mb-3">По типам:</h3>
                <div className="space-y-2">
                  {Object.entries(data.events.byType).map(([type, count]) => (
                    <div key={type} className="flex justify-between items-center p-2 rounded-lg hover:bg-white/50 transition-colors">
                      <span className="text-sm text-[var(--muted)]">{getTypeName(type)}:</span>
                      <span className="text-sm font-semibold text-[var(--foreground)]">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Статистика по контактам */}
        <div className="glass-panel rounded-3xl">
          <div className="p-6 border-b border-white/40">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Контакты</p>
            <h2 className="text-xl font-semibold text-slate-900 mt-1">Статистика по контактам</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-xl bg-white/50">
                <span className="text-[var(--muted)] font-medium">Всего:</span>
                <span className="font-semibold text-[var(--foreground)]">{data.contacts.total}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--success-soft)]/30">
                <span className="text-[var(--muted)] font-medium">С сделками:</span>
                <span className="font-semibold text-[var(--success)]">{data.contacts.withDeals}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--primary-soft)]/30">
                <span className="text-[var(--muted)] font-medium">Новых за период:</span>
                <span className="font-semibold text-[var(--primary)]">+{data.contacts.newThisPeriod}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

