'use client'

import { useState, useEffect } from 'react'
import SalesChart from './SalesChart'
import FunnelChart from './FunnelChart'
import ManagersReport from './ManagersReport'
import Skeleton from '@/components/Skeleton'

interface AnalyticsTabsProps {
  period: string
  selectedUserId: number | null
  selectedPipelineId: number | null
}

export default function AnalyticsTabs({ period, selectedUserId, selectedPipelineId }: AnalyticsTabsProps) {
  const [activeTab, setActiveTab] = useState<'sales' | 'funnel' | 'managers' | 'forecast' | 'compare'>('sales')
  const [salesData, setSalesData] = useState<any[]>([])
  const [funnelData, setFunnelData] = useState<any>(null)
  const [managersData, setManagersData] = useState<any[]>([])
  const [forecastData, setForecastData] = useState<any>(null)
  const [compareData, setCompareData] = useState<any>(null)
  const [loading, setLoading] = useState<Record<string, boolean>>({
    sales: false,
    funnel: false,
    managers: false,
    forecast: false,
    compare: false,
  })

  useEffect(() => {
    if (activeTab === 'sales') {
      fetchSalesData()
    } else if (activeTab === 'funnel') {
      fetchFunnelData()
    } else if (activeTab === 'managers') {
      fetchManagersData()
    } else if (activeTab === 'forecast') {
      fetchForecastData()
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

  const fetchForecastData = async () => {
    setLoading(prev => ({ ...prev, forecast: true }))
    try {
      const url = `/api/analytics/forecast?period=${period}${selectedUserId ? `&userId=${selectedUserId}` : ''}${selectedPipelineId ? `&pipelineId=${selectedPipelineId}` : ''}`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setForecastData(data)
      }
    } catch (error) {
      console.error('Error fetching forecast data:', error)
    } finally {
      setLoading(prev => ({ ...prev, forecast: false }))
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
    { id: 'sales', label: 'Продажи', icon: '📈' },
    { id: 'funnel', label: 'Воронка', icon: '🔽' },
    { id: 'managers', label: 'Менеджеры', icon: '👥' },
    { id: 'forecast', label: 'Прогноз', icon: '🔮' },
    { id: 'compare', label: 'Сравнение', icon: '⚖️' },
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
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Контент вкладок */}
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
            {activeTab === 'sales' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-[var(--foreground)]">Динамика продаж</h2>
                {salesData.length > 0 ? (
                  <SalesChart data={salesData} period={period} />
                ) : (
                  <div className="text-center py-12 text-[var(--muted)]">
                    Нет данных за выбранный период
                  </div>
                )}
              </div>
            )}

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

            {activeTab === 'forecast' && forecastData && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-[var(--foreground)]">Прогноз продаж</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-[var(--primary-soft)]/30">
                    <div className="text-xs text-[var(--muted)] mb-1">Взвешенный прогноз</div>
                    <div className="text-2xl font-bold text-[var(--primary)]">
                      {forecastData.forecast.weightedForecast.toLocaleString('ru-RU')} ₽
                    </div>
                    <div className="text-xs text-[var(--muted)] mt-1">
                      {forecastData.forecast.totalDeals} сделок
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--success-soft)]/30">
                    <div className="text-xs text-[var(--muted)] mb-1">Оптимистичный</div>
                    <div className="text-2xl font-bold text-[var(--success)]">
                      {forecastData.forecast.optimisticForecast.toLocaleString('ru-RU')} ₽
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--warning-soft)]/30">
                    <div className="text-xs text-[var(--muted)] mb-1">Пессимистичный</div>
                    <div className="text-2xl font-bold text-[var(--warning)]">
                      {forecastData.forecast.pessimisticForecast.toLocaleString('ru-RU')} ₽
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/50">
                    <div className="text-xs text-[var(--muted)] mb-1">Общая сумма</div>
                    <div className="text-2xl font-bold text-[var(--foreground)]">
                      {forecastData.forecast.totalAmount.toLocaleString('ru-RU')} ₽
                    </div>
                  </div>
                </div>
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Сделки в прогнозе</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {forecastData.forecast.deals.slice(0, 10).map((deal: any) => (
                      <div key={deal.id} className="p-3 rounded-lg bg-white/50 border border-[var(--border)]">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-[var(--foreground)]">{deal.title}</div>
                            <div className="text-xs text-[var(--muted)]">{deal.contact}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-[var(--foreground)]">
                              {deal.forecast.toLocaleString('ru-RU')} ₽
                            </div>
                            <div className="text-xs text-[var(--muted)]">
                              {deal.probability}% вероятность
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
                    <div className="text-xs text-[var(--muted)] mb-2">Выиграно (₽)</div>
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
          </>
        )}
      </div>
    </div>
  )
}

