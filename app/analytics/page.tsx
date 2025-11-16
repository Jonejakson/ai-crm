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

  // Подготовка данных для графика
  const maxValue = data.chartData.length > 0
    ? Math.max(
        ...data.chartData.map(d => d.contacts + d.tasks + d.deals + d.events),
        1
      )
    : 1

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
        <div className="h-64 flex items-end space-x-1 overflow-x-auto pb-8">
          {data.chartData.length > 0 ? (
            data.chartData.map((day, index) => {
              const date = new Date(day.date)
              const isToday = date.toDateString() === new Date().toDateString()
              const total = day.contacts + day.tasks + day.deals + day.events
              
              return (
                <div key={index} className="flex-1 min-w-[40px] flex flex-col items-center justify-end">
                  <div className="w-full flex flex-col justify-end h-48 space-y-0.5 relative group">
                    {total > 0 ? (
                      <>
                        {day.contacts > 0 && (
                          <div
                            className="bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer"
                            style={{ 
                              height: `${maxValue > 0 ? Math.max((day.contacts / maxValue) * 100, 5) : 5}%`,
                              minHeight: '4px'
                            }}
                            title={`Контакты: ${day.contacts}`}
                          />
                        )}
                        {day.tasks > 0 && (
                          <div
                            className="bg-orange-500 rounded-t hover:bg-orange-600 transition-colors cursor-pointer"
                            style={{ 
                              height: `${maxValue > 0 ? Math.max((day.tasks / maxValue) * 100, 5) : 5}%`,
                              minHeight: '4px'
                            }}
                            title={`Задачи: ${day.tasks}`}
                          />
                        )}
                        {day.deals > 0 && (
                          <div
                            className="bg-purple-500 rounded-t hover:bg-purple-600 transition-colors cursor-pointer"
                            style={{ 
                              height: `${maxValue > 0 ? Math.max((day.deals / maxValue) * 100, 5) : 5}%`,
                              minHeight: '4px'
                            }}
                            title={`Сделки: ${day.deals}`}
                          />
                        )}
                        {day.events > 0 && (
                          <div
                            className="bg-green-500 rounded-t hover:bg-green-600 transition-colors cursor-pointer"
                            style={{ 
                              height: `${maxValue > 0 ? Math.max((day.events / maxValue) * 100, 5) : 5}%`,
                              minHeight: '4px'
                            }}
                            title={`События: ${day.events}`}
                          />
                        )}
                      </>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                      </div>
                    )}
                    {total > 0 && (
                      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        Всего: {total}
                      </div>
                    )}
                  </div>
                  <div className={`text-xs mt-2 whitespace-nowrap ${isToday ? 'font-bold text-blue-600' : 'text-gray-500'}`}>
                    {date.getDate()}/{date.getMonth() + 1}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="w-full h-48 flex items-center justify-center text-gray-400">
              Нет данных за выбранный период
            </div>
          )}
        </div>
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

