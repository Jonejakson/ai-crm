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

  // Подготовка данных для графика (линейный)
  const chartHeight = 200
  const chartPadding = { top: 20, right: 20, bottom: 40, left: 50 }
  const chartWidth = Math.max(600, data.chartData.length * 30)
  
  // Находим максимальное значение для каждой категории отдельно
  const maxContacts = Math.max(...data.chartData.map(d => d.contacts), 0)
  const maxTasks = Math.max(...data.chartData.map(d => d.tasks), 0)
  const maxDeals = Math.max(...data.chartData.map(d => d.deals), 0)
  const maxEvents = Math.max(...data.chartData.map(d => d.events), 0)
  const maxValue = Math.max(maxContacts, maxTasks, maxDeals, maxEvents, 1)
  
  // Функция для преобразования значения в Y координату
  const getY = (value: number, maxForCategory: number = maxValue) => {
    const availableHeight = chartHeight - chartPadding.top - chartPadding.bottom
    if (maxForCategory === 0) {
      // Если все значения 0, рисуем линию посередине нижней части
      return chartHeight - chartPadding.bottom - (availableHeight * 0.1)
    }
    const normalizedValue = maxValue > 0 ? (value / maxValue) : 0
    return chartHeight - chartPadding.bottom - (normalizedValue * availableHeight)
  }
  
  // Функция для получения X координаты по индексу
  const getX = (index: number) => {
    const availableWidth = chartWidth - chartPadding.left - chartPadding.right
    if (data.chartData.length === 1) {
      return chartPadding.left + availableWidth / 2
    }
    return chartPadding.left + (index / (data.chartData.length - 1)) * availableWidth
  }
  
  // Генерация path для линии
  const generateLinePath = (values: number[], maxForCategory: number = maxValue) => {
    if (values.length === 0) return ''
    const points = values.map((value, index) => {
      const x = getX(index)
      const y = getY(value, maxForCategory)
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    return points.join(' ')
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
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <UserFilter 
              selectedUserId={selectedUserId} 
              onUserChange={setSelectedUserId} 
            />
          </div>
          <div className="flex-1">
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
            subtitle: `Выиграно: ${data.deals.wonAmount.toLocaleString('ru-RU')} ₽`
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

      {/* Новые разделы аналитики */}
      <AnalyticsTabs 
        period={period}
        selectedUserId={selectedUserId}
        selectedPipelineId={selectedPipelineId}
      />

      {/* График динамики */}
      <div className="glass-panel rounded-3xl">
        <div className="p-6 border-b border-white/40">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">График</p>
          <h2 className="text-xl font-semibold text-slate-900 mt-1">Динамика за период</h2>
        </div>
        <div className="p-6">
        {data.chartData.length > 0 ? (
          <div className="overflow-x-auto">
            <svg width={chartWidth} height={chartHeight + 60} className="w-full">
              {/* Сетка и оси */}
              <defs>
                <linearGradient id="contactsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="tasksGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="dealsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="eventsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>
              
              {/* Горизонтальные линии сетки */}
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
                      strokeWidth="1"
                      strokeDasharray="4,4"
                    />
                    <text
                      x={chartPadding.left - 10}
                      y={y + 4}
                      textAnchor="end"
                      fontSize="10"
                      fill="#6b7280"
                    >
                      {Math.round(maxValue * ratio)}
                    </text>
                  </g>
                )
              })}
              
              {/* Линия Контакты */}
              {maxContacts > 0 || data.chartData.some(d => d.contacts > 0) ? (
                <>
                  <path
                    d={generateLinePath(data.chartData.map(d => d.contacts), maxContacts)}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Область под линией Контакты */}
                  <path
                    d={`${generateLinePath(data.chartData.map(d => d.contacts), maxContacts)} L ${getX(data.chartData.length - 1)} ${chartHeight - chartPadding.bottom} L ${getX(0)} ${chartHeight - chartPadding.bottom} Z`}
                    fill="url(#contactsGradient)"
                  />
                </>
              ) : (
                <line
                  x1={getX(0)}
                  y1={getY(0, maxContacts)}
                  x2={getX(data.chartData.length - 1)}
                  y2={getY(0, maxContacts)}
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="5,5"
                  opacity="0.5"
                />
              )}
              
              {/* Линия Задачи */}
              {maxTasks > 0 || data.chartData.some(d => d.tasks > 0) ? (
                <>
                  <path
                    d={generateLinePath(data.chartData.map(d => d.tasks), maxTasks)}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Область под линией Задачи */}
                  <path
                    d={`${generateLinePath(data.chartData.map(d => d.tasks), maxTasks)} L ${getX(data.chartData.length - 1)} ${chartHeight - chartPadding.bottom} L ${getX(0)} ${chartHeight - chartPadding.bottom} Z`}
                    fill="url(#tasksGradient)"
                  />
                </>
              ) : (
                <line
                  x1={getX(0)}
                  y1={getY(0, maxTasks)}
                  x2={getX(data.chartData.length - 1)}
                  y2={getY(0, maxTasks)}
                  stroke="#f97316"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="5,5"
                  opacity="0.5"
                />
              )}
              
              {/* Линия Сделки */}
              {maxDeals > 0 || data.chartData.some(d => d.deals > 0) ? (
                <>
                  <path
                    d={generateLinePath(data.chartData.map(d => d.deals), maxDeals)}
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Область под линией Сделки */}
                  <path
                    d={`${generateLinePath(data.chartData.map(d => d.deals), maxDeals)} L ${getX(data.chartData.length - 1)} ${chartHeight - chartPadding.bottom} L ${getX(0)} ${chartHeight - chartPadding.bottom} Z`}
                    fill="url(#dealsGradient)"
                  />
                </>
              ) : (
                <line
                  x1={getX(0)}
                  y1={getY(0, maxDeals)}
                  x2={getX(data.chartData.length - 1)}
                  y2={getY(0, maxDeals)}
                  stroke="#a855f7"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="5,5"
                  opacity="0.5"
                />
              )}
              
              {/* Линия События */}
              {maxEvents > 0 || data.chartData.some(d => d.events > 0) ? (
                <>
                  <path
                    d={generateLinePath(data.chartData.map(d => d.events), maxEvents)}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Область под линией События */}
                  <path
                    d={`${generateLinePath(data.chartData.map(d => d.events), maxEvents)} L ${getX(data.chartData.length - 1)} ${chartHeight - chartPadding.bottom} L ${getX(0)} ${chartHeight - chartPadding.bottom} Z`}
                    fill="url(#eventsGradient)"
                  />
                </>
              ) : (
                <line
                  x1={getX(0)}
                  y1={getY(0, maxEvents)}
                  x2={getX(data.chartData.length - 1)}
                  y2={getY(0, maxEvents)}
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="5,5"
                  opacity="0.5"
                />
              )}
              
              {/* Точки на линиях */}
              {data.chartData.map((day, index) => {
                const date = new Date(day.date)
                const isToday = date.toDateString() === new Date().toDateString()
                const x = getX(index)
                
                return (
                  <g key={index}>
                    {/* Точка Контакты */}
                    <circle
                      cx={x}
                      cy={getY(day.contacts, maxContacts)}
                      r={day.contacts > 0 ? "4" : "3"}
                      fill={day.contacts > 0 ? "#3b82f6" : "transparent"}
                      stroke={day.contacts > 0 ? "white" : "#3b82f6"}
                      strokeWidth={day.contacts > 0 ? "2" : "1.5"}
                      className="hover:r-6 transition-all cursor-pointer"
                      opacity={day.contacts > 0 ? 1 : 0.6}
                    >
                      <title>Контакты: {day.contacts}</title>
                    </circle>
                    {/* Точка Задачи */}
                    <circle
                      cx={x}
                      cy={getY(day.tasks, maxTasks)}
                      r={day.tasks > 0 ? "4" : "3"}
                      fill={day.tasks > 0 ? "#f97316" : "transparent"}
                      stroke={day.tasks > 0 ? "white" : "#f97316"}
                      strokeWidth={day.tasks > 0 ? "2" : "1.5"}
                      className="hover:r-6 transition-all cursor-pointer"
                      opacity={day.tasks > 0 ? 1 : 0.6}
                    >
                      <title>Задачи: {day.tasks}</title>
                    </circle>
                    {/* Точка Сделки */}
                    <circle
                      cx={x}
                      cy={getY(day.deals, maxDeals)}
                      r={day.deals > 0 ? "4" : "3"}
                      fill={day.deals > 0 ? "#a855f7" : "transparent"}
                      stroke={day.deals > 0 ? "white" : "#a855f7"}
                      strokeWidth={day.deals > 0 ? "2" : "1.5"}
                      className="hover:r-6 transition-all cursor-pointer"
                      opacity={day.deals > 0 ? 1 : 0.6}
                    >
                      <title>Сделки: {day.deals}</title>
                    </circle>
                    {/* Точка События */}
                    <circle
                      cx={x}
                      cy={getY(day.events, maxEvents)}
                      r={day.events > 0 ? "4" : "3"}
                      fill={day.events > 0 ? "#10b981" : "transparent"}
                      stroke={day.events > 0 ? "white" : "#10b981"}
                      strokeWidth={day.events > 0 ? "2" : "1.5"}
                      className="hover:r-6 transition-all cursor-pointer"
                      opacity={day.events > 0 ? 1 : 0.6}
                    >
                      <title>События: {day.events}</title>
                    </circle>
                    {/* Подпись даты */}
                    <text
                      x={x}
                      y={chartHeight + 20}
                      textAnchor="middle"
                      fontSize="10"
                      fill={isToday ? "#3b82f6" : "#6b7280"}
                      fontWeight={isToday ? "bold" : "normal"}
                    >
                      {date.getDate()}/{date.getMonth() + 1}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <h3 className="empty-state-title">Нет данных</h3>
            <p className="empty-state-description">
              Нет данных за выбранный период. Попробуйте выбрать другой период.
            </p>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-4 mt-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[var(--primary)]"></div>
            <span className="text-[var(--muted)]">Контакты</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[var(--warning)]"></div>
            <span className="text-[var(--muted)]">Задачи</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[var(--accent)]"></div>
            <span className="text-[var(--muted)]">Сделки</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[var(--success)]"></div>
            <span className="text-[var(--muted)]">События</span>
          </div>
        </div>
        </div>
      </div>

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
                <span className="text-[var(--muted)] font-medium">Выиграно:</span>
                <span className="font-semibold text-[var(--success)]">
                  {data.deals.won} ({data.deals.wonAmount.toLocaleString('ru-RU')} ₽)
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--error-soft)]/30">
                <span className="text-[var(--muted)] font-medium">Проиграно:</span>
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

