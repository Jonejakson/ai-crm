'use client'

import { useState, useEffect } from 'react'
import UserFilter from '@/components/UserFilter'

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

  useEffect(() => {
    fetchAnalytics()
  }, [period, selectedUserId])

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
    return <div className="flex justify-center p-8">Загрузка...</div>
  }

  if (!data) {
    return <div className="flex justify-center p-8">Ошибка загрузки данных</div>
  }

  // Подготовка данных для графика (линейный)
  const chartHeight = 200
  const chartPadding = { top: 20, right: 20, bottom: 40, left: 40 }
  const chartWidth = Math.max(600, data.chartData.length * 30)
  
  // Находим максимальное значение для каждой категории отдельно
  const maxContacts = Math.max(...data.chartData.map(d => d.contacts), 1)
  const maxTasks = Math.max(...data.chartData.map(d => d.tasks), 1)
  const maxDeals = Math.max(...data.chartData.map(d => d.deals), 1)
  const maxEvents = Math.max(...data.chartData.map(d => d.events), 1)
  const maxValue = Math.max(maxContacts, maxTasks, maxDeals, maxEvents, 1)
  
  // Функция для преобразования значения в Y координату
  const getY = (value: number) => {
    return chartHeight - chartPadding.bottom - ((value / maxValue) * (chartHeight - chartPadding.top - chartPadding.bottom))
  }
  
  // Функция для получения X координаты по индексу
  const getX = (index: number) => {
    const availableWidth = chartWidth - chartPadding.left - chartPadding.right
    return chartPadding.left + (index / (data.chartData.length - 1 || 1)) * availableWidth
  }
  
  // Генерация path для линии
  const generateLinePath = (values: number[]) => {
    if (values.length === 0) return ''
    const points = values.map((value, index) => {
      const x = getX(index)
      const y = getY(value)
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    return points.join(' ')
  }

  return (
    <div className="space-y-6">
      {/* Заголовок и фильтр периода */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Аналитика и отчеты</h1>
      </div>
      
      {/* Фильтр по менеджеру (только для админа) */}
      <UserFilter 
        selectedUserId={selectedUserId} 
        onUserChange={setSelectedUserId} 
      />
      
      <div className="flex justify-between items-center">
        <div className="flex space-x-2">
          <button
            onClick={() => setPeriod('week')}
            className={`px-4 py-2 rounded-lg ${
              period === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-100'
            }`}
          >
            Неделя
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-2 rounded-lg ${
              period === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-100'
            }`}
          >
            Месяц
          </button>
          <button
            onClick={() => setPeriod('year')}
            className={`px-4 py-2 rounded-lg ${
              period === 'year' ? 'bg-blue-600 text-white' : 'bg-gray-100'
            }`}
          >
            Год
          </button>
        </div>
      </div>

      {/* Основная статистика */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500">Всего клиентов</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">{data.contacts.total}</p>
          <p className="text-sm text-gray-500 mt-1">
            Новых за период: +{data.contacts.newThisPeriod}
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500">Активные задачи</h3>
          <p className="text-3xl font-bold text-orange-600 mt-2">{data.tasks.pending}</p>
          <p className="text-sm text-gray-500 mt-1">
            Просрочено: {data.tasks.overdue}
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500">Активные сделки</h3>
          <p className="text-3xl font-bold text-purple-600 mt-2">{data.deals.active}</p>
          <p className="text-sm text-gray-500 mt-1">
            Всего: {data.deals.total}
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500">Сумма сделок</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">
            {data.deals.totalAmount.toLocaleString('ru-RU')} ₽
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Выиграно: {data.deals.wonAmount.toLocaleString('ru-RU')} ₽
          </p>
        </div>
      </div>

      {/* График динамики */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold mb-4">Динамика за период</h2>
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
              <path
                d={generateLinePath(data.chartData.map(d => d.contacts))}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Область под линией Контакты */}
              <path
                d={`${generateLinePath(data.chartData.map(d => d.contacts))} L ${getX(data.chartData.length - 1)} ${chartHeight - chartPadding.bottom} L ${getX(0)} ${chartHeight - chartPadding.bottom} Z`}
                fill="url(#contactsGradient)"
              />
              
              {/* Линия Задачи */}
              <path
                d={generateLinePath(data.chartData.map(d => d.tasks))}
                fill="none"
                stroke="#f97316"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Область под линией Задачи */}
              <path
                d={`${generateLinePath(data.chartData.map(d => d.tasks))} L ${getX(data.chartData.length - 1)} ${chartHeight - chartPadding.bottom} L ${getX(0)} ${chartHeight - chartPadding.bottom} Z`}
                fill="url(#tasksGradient)"
              />
              
              {/* Линия Сделки */}
              <path
                d={generateLinePath(data.chartData.map(d => d.deals))}
                fill="none"
                stroke="#a855f7"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Область под линией Сделки */}
              <path
                d={`${generateLinePath(data.chartData.map(d => d.deals))} L ${getX(data.chartData.length - 1)} ${chartHeight - chartPadding.bottom} L ${getX(0)} ${chartHeight - chartPadding.bottom} Z`}
                fill="url(#dealsGradient)"
              />
              
              {/* Линия События */}
              <path
                d={generateLinePath(data.chartData.map(d => d.events))}
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Область под линией События */}
              <path
                d={`${generateLinePath(data.chartData.map(d => d.events))} L ${getX(data.chartData.length - 1)} ${chartHeight - chartPadding.bottom} L ${getX(0)} ${chartHeight - chartPadding.bottom} Z`}
                fill="url(#eventsGradient)"
              />
              
              {/* Точки на линиях */}
              {data.chartData.map((day, index) => {
                const date = new Date(day.date)
                const isToday = date.toDateString() === new Date().toDateString()
                const x = getX(index)
                
                return (
                  <g key={index}>
                    {/* Точка Контакты */}
                    {day.contacts > 0 && (
                      <circle
                        cx={x}
                        cy={getY(day.contacts)}
                        r="4"
                        fill="#3b82f6"
                        stroke="white"
                        strokeWidth="2"
                        className="hover:r-6 transition-all cursor-pointer"
                      >
                        <title>Контакты: {day.contacts}</title>
                      </circle>
                    )}
                    {/* Точка Задачи */}
                    {day.tasks > 0 && (
                      <circle
                        cx={x}
                        cy={getY(day.tasks)}
                        r="4"
                        fill="#f97316"
                        stroke="white"
                        strokeWidth="2"
                        className="hover:r-6 transition-all cursor-pointer"
                      >
                        <title>Задачи: {day.tasks}</title>
                      </circle>
                    )}
                    {/* Точка Сделки */}
                    {day.deals > 0 && (
                      <circle
                        cx={x}
                        cy={getY(day.deals)}
                        r="4"
                        fill="#a855f7"
                        stroke="white"
                        strokeWidth="2"
                        className="hover:r-6 transition-all cursor-pointer"
                      >
                        <title>Сделки: {day.deals}</title>
                      </circle>
                    )}
                    {/* Точка События */}
                    {day.events > 0 && (
                      <circle
                        cx={x}
                        cy={getY(day.events)}
                        r="4"
                        fill="#10b981"
                        stroke="white"
                        strokeWidth="2"
                        className="hover:r-6 transition-all cursor-pointer"
                      >
                        <title>События: {day.events}</title>
                      </circle>
                    )}
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
          <div className="w-full h-64 flex items-center justify-center text-gray-400">
            Нет данных за выбранный период
          </div>
        )}
        <div className="flex justify-center space-x-4 mt-4 text-sm">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-500 rounded mr-2"></div>
            <span>Контакты</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-orange-500 rounded mr-2"></div>
            <span>Задачи</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-purple-500 rounded mr-2"></div>
            <span>Сделки</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
            <span>События</span>
          </div>
        </div>
      </div>

      {/* Детальная статистика */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Статистика по сделкам */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">Статистика по сделкам</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Выиграно:</span>
              <span className="font-semibold text-green-600">
                {data.deals.won} ({data.deals.wonAmount.toLocaleString('ru-RU')} ₽)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Проиграно:</span>
              <span className="font-semibold text-red-600">
                {data.deals.lost} ({data.deals.lostAmount.toLocaleString('ru-RU')} ₽)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Конверсия:</span>
              <span className="font-semibold">
                {data.deals.total > 0 
                  ? ((data.deals.won / data.deals.total) * 100).toFixed(1) 
                  : 0}%
              </span>
            </div>
            <div className="mt-4 pt-4 border-t">
              <h3 className="font-semibold mb-2">По этапам:</h3>
              {Object.entries(data.deals.byStage).map(([stage, count]) => (
                <div key={stage} className="flex justify-between mb-1">
                  <span className="text-sm text-gray-600">{getStageName(stage)}:</span>
                  <span className="text-sm font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Статистика по задачам */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">Статистика по задачам</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Всего:</span>
              <span className="font-semibold">{data.tasks.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">В работе:</span>
              <span className="font-semibold text-orange-600">{data.tasks.pending}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Завершено:</span>
              <span className="font-semibold text-green-600">{data.tasks.completed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Просрочено:</span>
              <span className="font-semibold text-red-600">{data.tasks.overdue}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Выполнение:</span>
              <span className="font-semibold">
                {data.tasks.total > 0 
                  ? ((data.tasks.completed / data.tasks.total) * 100).toFixed(1) 
                  : 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Статистика по событиям */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">Статистика по событиям</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Всего:</span>
              <span className="font-semibold">{data.events.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Предстоящие:</span>
              <span className="font-semibold text-blue-600">{data.events.upcoming}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Прошедшие:</span>
              <span className="font-semibold text-gray-600">{data.events.past}</span>
            </div>
            <div className="mt-4 pt-4 border-t">
              <h3 className="font-semibold mb-2">По типам:</h3>
              {Object.entries(data.events.byType).map(([type, count]) => (
                <div key={type} className="flex justify-between mb-1">
                  <span className="text-sm text-gray-600">{getTypeName(type)}:</span>
                  <span className="text-sm font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Статистика по контактам */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">Статистика по контактам</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Всего:</span>
              <span className="font-semibold">{data.contacts.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">С сделками:</span>
              <span className="font-semibold text-green-600">{data.contacts.withDeals}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Новых за период:</span>
              <span className="font-semibold text-blue-600">+{data.contacts.newThisPeriod}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

