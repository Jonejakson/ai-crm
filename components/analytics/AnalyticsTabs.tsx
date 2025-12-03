'use client'

import { useState, useEffect } from 'react'
import SalesChart from './SalesChart'
import FunnelChart from './FunnelChart'
import ManagersReport from './ManagersReport'
import DashboardBuilder from './DashboardBuilder'
import Skeleton from '@/components/Skeleton'
import { ChartLineIcon, FunnelIcon, UsersGroupIcon, ScaleIcon, PaletteIcon, ChartBarIcon } from '@/components/Icons'

interface ChartPoint {
  date: string
  contacts: number
  tasks: number
  deals: number
  events: number
}

function PeriodDynamicsChart({ chartData }: { chartData: ChartPoint[] }) {
  const chartHeight = 200
  const chartPadding = { top: 20, right: 20, bottom: 40, left: 50 }
  const chartWidth = Math.max(600, chartData.length * 30)

  const maxContacts = Math.max(...chartData.map(d => d.contacts), 0)
  const maxTasks = Math.max(...chartData.map(d => d.tasks), 0)
  const maxDeals = Math.max(...chartData.map(d => d.deals), 0)
  const maxEvents = Math.max(...chartData.map(d => d.events), 0)
  const maxValue = Math.max(maxContacts, maxTasks, maxDeals, maxEvents, 1)

  const getY = (value: number, maxForCategory: number = maxValue) => {
    const availableHeight = chartHeight - chartPadding.top - chartPadding.bottom
    if (maxForCategory === 0) {
      return chartHeight - chartPadding.bottom - availableHeight * 0.1
    }
    const normalizedValue = maxValue > 0 ? value / maxValue : 0
    return chartHeight - chartPadding.bottom - normalizedValue * availableHeight
  }

  const getX = (index: number) => {
    const availableWidth = chartWidth - chartPadding.left - chartPadding.right
    if (chartData.length === 1) {
      return chartPadding.left + availableWidth / 2
    }
    return chartPadding.left + (index / (chartData.length - 1)) * availableWidth
  }

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
    <div className="glass-panel rounded-3xl p-6 h-full flex flex-col">
      <div className="border-b border-white/40 pb-4 mb-4">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">График</p>
        <h2 className="text-xl font-semibold text-slate-900 mt-1">Динамика за период</h2>
      </div>
      {chartData.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <svg width={chartWidth} height={chartHeight + 60} className="w-full">
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
                    <text x={chartPadding.left - 10} y={y + 4} textAnchor="end" fontSize="10" fill="#6b7280">
                      {Math.round(maxValue * ratio)}
                    </text>
                  </g>
                )
              })}

              {/* Контакты */}
              {maxContacts > 0 || chartData.some(d => d.contacts > 0) ? (
                <>
                  <path
                    d={generateLinePath(chartData.map(d => d.contacts), maxContacts)}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={`${generateLinePath(chartData.map(d => d.contacts), maxContacts)} L ${getX(chartData.length - 1)} ${chartHeight - chartPadding.bottom} L ${getX(0)} ${chartHeight - chartPadding.bottom} Z`}
                    fill="url(#contactsGradient)"
                  />
                </>
              ) : (
                <line
                  x1={getX(0)}
                  y1={getY(0, maxContacts)}
                  x2={getX(chartData.length - 1)}
                  y2={getY(0, maxContacts)}
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  strokeDasharray="5,5"
                  opacity="0.5"
                />
              )}

              {/* Задачи */}
              {maxTasks > 0 || chartData.some(d => d.tasks > 0) ? (
                <>
                  <path
                    d={generateLinePath(chartData.map(d => d.tasks), maxTasks)}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={`${generateLinePath(chartData.map(d => d.tasks), maxTasks)} L ${getX(chartData.length - 1)} ${chartHeight - chartPadding.bottom} L ${getX(0)} ${chartHeight - chartPadding.bottom} Z`}
                    fill="url(#tasksGradient)"
                  />
                </>
              ) : (
                <line
                  x1={getX(0)}
                  y1={getY(0, maxTasks)}
                  x2={getX(chartData.length - 1)}
                  y2={getY(0, maxTasks)}
                  stroke="#f97316"
                  strokeWidth="2.5"
                  strokeDasharray="5,5"
                  opacity="0.5"
                />
              )}

              {/* Сделки */}
              {maxDeals > 0 || chartData.some(d => d.deals > 0) ? (
                <>
                  <path
                    d={generateLinePath(chartData.map(d => d.deals), maxDeals)}
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={`${generateLinePath(chartData.map(d => d.deals), maxDeals)} L ${getX(chartData.length - 1)} ${chartHeight - chartPadding.bottom} L ${getX(0)} ${chartHeight - chartPadding.bottom} Z`}
                    fill="url(#dealsGradient)"
                  />
                </>
              ) : (
                <line
                  x1={getX(0)}
                  y1={getY(0, maxDeals)}
                  x2={getX(chartData.length - 1)}
                  y2={getY(0, maxDeals)}
                  stroke="#a855f7"
                  strokeWidth="2.5"
                  strokeDasharray="5,5"
                  opacity="0.5"
                />
              )}

              {/* События */}
              {maxEvents > 0 || chartData.some(d => d.events > 0) ? (
                <>
                  <path
                    d={generateLinePath(chartData.map(d => d.events), maxEvents)}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={`${generateLinePath(chartData.map(d => d.events), maxEvents)} L ${getX(chartData.length - 1)} ${chartHeight - chartPadding.bottom} L ${getX(0)} ${chartHeight - chartPadding.bottom} Z`}
                    fill="url(#eventsGradient)"
                  />
                </>
              ) : (
                <line
                  x1={getX(0)}
                  y1={getY(0, maxEvents)}
                  x2={getX(chartData.length - 1)}
                  y2={getY(0, maxEvents)}
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeDasharray="5,5"
                  opacity="0.5"
                />
              )}

              {chartData.map((day, index) => {
                const date = new Date(day.date)
                const isToday = date.toDateString() === new Date().toDateString()
                const x = getX(index)

                return (
                  <g key={index}>
                    <circle
                      cx={x}
                      cy={getY(day.contacts, maxContacts)}
                      r={day.contacts > 0 ? 4 : 3}
                      fill={day.contacts > 0 ? '#3b82f6' : 'transparent'}
                      stroke={day.contacts > 0 ? 'white' : '#3b82f6'}
                      strokeWidth={day.contacts > 0 ? 2 : 1.5}
                      className="hover:r-6 transition-all cursor-pointer"
                      opacity={day.contacts > 0 ? 1 : 0.6}
                    >
                      <title>Контакты: {day.contacts}</title>
                    </circle>

                    <circle
                      cx={x}
                      cy={getY(day.tasks, maxTasks)}
                      r={day.tasks > 0 ? 4 : 3}
                      fill={day.tasks > 0 ? '#f97316' : 'transparent'}
                      stroke={day.tasks > 0 ? 'white' : '#f97316'}
                      strokeWidth={day.tasks > 0 ? 2 : 1.5}
                      className="hover:r-6 transition-all cursor-pointer"
                      opacity={day.tasks > 0 ? 1 : 0.6}
                    >
                      <title>Задачи: {day.tasks}</title>
                    </circle>

                    <circle
                      cx={x}
                      cy={getY(day.deals, maxDeals)}
                      r={day.deals > 0 ? 4 : 3}
                      fill={day.deals > 0 ? '#a855f7' : 'transparent'}
                      stroke={day.deals > 0 ? 'white' : '#a855f7'}
                      strokeWidth={day.deals > 0 ? 2 : 1.5}
                      className="hover:r-6 transition-all cursor-pointer"
                      opacity={day.deals > 0 ? 1 : 0.6}
                    >
                      <title>Сделки: {day.deals}</title>
                    </circle>

                    <circle
                      cx={x}
                      cy={getY(day.events, maxEvents)}
                      r={day.events > 0 ? 4 : 3}
                      fill={day.events > 0 ? '#10b981' : 'transparent'}
                      stroke={day.events > 0 ? 'white' : '#10b981'}
                      strokeWidth={day.events > 0 ? 2 : 1.5}
                      className="hover:r-6 transition-all cursor-pointer"
                      opacity={day.events > 0 ? 1 : 0.6}
                    >
                      <title>События: {day.events}</title>
                    </circle>

                    <text
                      x={x}
                      y={chartHeight + 20}
                      textAnchor="middle"
                      fontSize="10"
                      fill={isToday ? '#3b82f6' : '#6b7280'}
                      fontWeight={isToday ? 'bold' : 'normal'}
                    >
                      {date.getDate()}/{date.getMonth() + 1}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#3b82f6]"></div>
              <span className="text-[var(--muted)]">Контакты</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#f97316]"></div>
              <span className="text-[var(--muted)]">Задачи</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#a855f7]"></div>
              <span className="text-[var(--muted)]">Сделки</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#10b981]"></div>
              <span className="text-[var(--muted)]">События</span>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <ChartBarIcon className="w-12 h-12 text-[var(--muted)]" />
          </div>
          <h3 className="empty-state-title">Нет данных</h3>
          <p className="empty-state-description">
            Нет данных за выбранный период. Попробуйте выбрать другой период.
          </p>
        </div>
      )}
    </div>
  )
}

interface AnalyticsTabsProps {
  period: string
  selectedUserId: number | null
  selectedPipelineId: number | null
  analyticsData?: any
  chartData?: ChartPoint[]
}

export default function AnalyticsTabs({ period, selectedUserId, selectedPipelineId, analyticsData, chartData = [] }: AnalyticsTabsProps) {
  const [activeTab, setActiveTab] = useState<'sales' | 'funnel' | 'managers' | 'compare' | 'builder'>('sales')
  const [salesData, setSalesData] = useState<any[]>([])
  const [funnelData, setFunnelData] = useState<any>(null)
  const [managersData, setManagersData] = useState<any[]>([])
  const [compareData, setCompareData] = useState<any>(null)
  const [loading, setLoading] = useState<Record<string, boolean>>({
    sales: false,
    funnel: false,
    managers: false,
    compare: false,
  })

  useEffect(() => {
    if (activeTab === 'sales') {
      fetchSalesData()
    } else if (activeTab === 'funnel') {
      fetchFunnelData()
    } else if (activeTab === 'managers') {
      fetchManagersData()
    } else if (activeTab === 'compare') {
      fetchCompareData()
    }
  }, [activeTab, period, selectedUserId, selectedPipelineId])

  const fetchSalesData = async () => {
    setLoading(prev => ({ ...prev, sales: true }))
    try {
      const url = `/api/analytics/sales?period=${period}${selectedUserId ? `&userId=${selectedUserId}` : ''}${selectedPipelineId ? `&pipelineId=${selectedPipelineId}` : ''}`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setSalesData(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching sales data:', error)
    } finally {
      setLoading(prev => ({ ...prev, sales: false }))
    }
  }

  const fetchFunnelData = async () => {
    setLoading(prev => ({ ...prev, funnel: true }))
    try {
      const url = `/api/analytics/funnel?period=${period}${selectedUserId ? `&userId=${selectedUserId}` : ''}${selectedPipelineId ? `&pipelineId=${selectedPipelineId}` : ''}`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setFunnelData(data)
      }
    } catch (error) {
      console.error('Error fetching funnel data:', error)
    } finally {
      setLoading(prev => ({ ...prev, funnel: false }))
    }
  }

  const fetchManagersData = async () => {
    setLoading(prev => ({ ...prev, managers: true }))
    try {
      const url = `/api/analytics/managers?period=${period}`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setManagersData(data.managers || [])
      }
    } catch (error) {
      console.error('Error fetching managers data:', error)
    } finally {
      setLoading(prev => ({ ...prev, managers: false }))
    }
  }

  const fetchCompareData = async () => {
    setLoading(prev => ({ ...prev, compare: true }))
    try {
      const url = `/api/analytics/compare?period=${period}${selectedUserId ? `&userId=${selectedUserId}` : ''}${selectedPipelineId ? `&pipelineId=${selectedPipelineId}` : ''}`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setCompareData(data)
      }
    } catch (error) {
      console.error('Error fetching compare data:', error)
    } finally {
      setLoading(prev => ({ ...prev, compare: false }))
    }
  }

  const tabs = [
    { id: 'sales', label: 'Продажи', Icon: ChartLineIcon },
    { id: 'funnel', label: 'Воронка', Icon: FunnelIcon },
    { id: 'managers', label: 'Менеджеры', Icon: UsersGroupIcon },
    { id: 'compare', label: 'Сравнение', Icon: ScaleIcon },
    { id: 'builder', label: 'Конструктор', Icon: PaletteIcon },
  ]

  return (
    <div className="space-y-6">
      {/* Вкладки */}
      <div className="glass-panel rounded-3xl p-2">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-lg'
                  : 'bg-white text-[var(--muted)] border border-[var(--border)] hover:border-[var(--primary)]'
              }`}
            >
              <tab.Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Контент вкладок */}
      {activeTab === 'sales' ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="glass-panel rounded-3xl p-3 md:p-6">
            {loading.sales ? (
              <div className="flex items-center justify-center h-64">
                <Skeleton variant="rectangular" width={400} height={220} className="mb-4" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="px-2 md:px-0">
                  <h2 className="text-lg md:text-xl font-semibold text-[var(--foreground)]">Динамика продаж</h2>
                </div>
                {salesData.length > 0 ? (
                  <div className="w-full overflow-x-auto -mx-4 px-2 md:-mx-6 md:px-6 lg:mx-0 lg:px-0">
                    <div className="min-w-0 md:min-w-0">
                      <div className="w-full">
                        <SalesChart data={salesData} period={period} height={320} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-[var(--muted)]">
                    Нет данных за выбранный период
                  </div>
                )}
              </div>
            )}
          </div>
          <PeriodDynamicsChart chartData={chartData} />
        </div>
      ) : (
        <div className="glass-panel rounded-3xl p-6">
          {loading[activeTab] ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Skeleton variant="rectangular" width={600} height={300} className="mb-4" />
                <p className="text-[var(--muted)]">Загрузка данных...</p>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'funnel' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-[var(--foreground)]">Воронка конверсии</h2>
                  {funnelData?.funnels && funnelData.funnels.length > 0 ? (
                    funnelData.funnels.map((funnel: any) => (
                      <FunnelChart
                        key={funnel.pipeline.id}
                        stages={Object.values(funnel.stages)}
                        pipelineName={funnel.pipeline.name}
                      />
                    ))
                  ) : (
                    <div className="text-center py-12 text-[var(--muted)]">
                      Нет данных по воронкам
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'managers' && (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-[var(--foreground)]">Отчет по менеджерам</h2>
                  {managersData.length > 0 ? (
                    <ManagersReport managers={managersData} />
                  ) : (
                    <div className="text-center py-12 text-[var(--muted)]">
                      Нет данных по менеджерам
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'compare' && compareData && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-[var(--foreground)]">Сравнение периодов</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-white/50 border border-[var(--border)]">
                      <div className="text-xs text-[var(--muted)] mb-2">Сделки</div>
                      <div className="text-2xl font-bold text-[var(--foreground)] mb-2">
                        {compareData.comparison.deals.current.total}
                      </div>
                      <div className={`text-sm ${compareData.comparison.deals.change.total >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                        {compareData.comparison.deals.change.total >= 0 ? '↑' : '↓'} {Math.abs(compareData.comparison.deals.change.total).toFixed(1)}%
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/50 border border-[var(--border)]">
                      <div className="text-xs text-[var(--muted)] mb-2">Выручка (₽)</div>
                      <div className="text-2xl font-bold text-[var(--foreground)] mb-2">
                        {compareData.comparison.deals.current.wonAmount.toLocaleString('ru-RU')} ₽
                      </div>
                      <div className={`text-sm ${compareData.comparison.deals.change.wonAmount >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                        {compareData.comparison.deals.change.wonAmount >= 0 ? '↑' : '↓'} {Math.abs(compareData.comparison.deals.change.wonAmount).toFixed(1)}%
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/50 border border-[var(--border)]">
                      <div className="text-xs text-[var(--muted)] mb-2">Конверсия</div>
                      <div className="text-2xl font-bold text-[var(--foreground)] mb-2">
                        {compareData.comparison.deals.current.conversion.toFixed(1)}%
                      </div>
                      <div className={`text-sm ${compareData.comparison.deals.change.conversion >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                        {compareData.comparison.deals.change.conversion >= 0 ? '↑' : '↓'} {Math.abs(compareData.comparison.deals.change.conversion).toFixed(1)}п.п.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'builder' && analyticsData && (
                <DashboardBuilder data={analyticsData} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
