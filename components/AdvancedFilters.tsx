'use client'

import { useState, useEffect } from 'react'

interface FilterOptions {
  contacts?: {
    companies: string[]
  }
  tasks?: {
    statuses: string[]
  }
  deals?: {
    stages: string[]
    currencies: string[]
    pipelines: Array<{ id: number; name: string }>
  }
  events?: {
    types: string[]
  }
}

interface AdvancedFiltersProps {
  type: 'contacts' | 'tasks' | 'deals' | 'events'
  onFilterChange: (filters: Record<string, any>) => void
  initialFilters?: Record<string, any>
}

export default function AdvancedFilters({
  type,
  onFilterChange,
  initialFilters = {},
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<FilterOptions>({})
  const [filters, setFilters] = useState<Record<string, any>>(initialFilters)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchFilterOptions()
  }, [type])

  const fetchFilterOptions = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/filters?type=${type}`)
      if (response.ok) {
        const data = await response.json()
        setOptions(data.filters || {})
      }
    } catch (error) {
      console.error('Error fetching filter options:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const clearFilters = () => {
    const clearedFilters: Record<string, any> = {}
    setFilters(clearedFilters)
    onFilterChange(clearedFilters)
  }

  const hasActiveFilters = Object.keys(filters).some(key => {
    const value = filters[key]
    if (Array.isArray(value)) return value.length > 0
    return value !== null && value !== undefined && value !== ''
  })

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
          hasActiveFilters
            ? 'bg-blue-50 border-blue-300 text-blue-700'
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <span>🔍</span>
        <span>Фильтры</span>
        {hasActiveFilters && (
          <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
            {Object.keys(filters).filter(k => {
              const v = filters[k]
              if (Array.isArray(v)) return v.length > 0
              return v !== null && v !== undefined && v !== ''
            }).length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 right-0 w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">Расширенные фильтры</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {loading ? (
            <div className="text-center py-4 text-gray-500">Загрузка...</div>
          ) : (
            <div className="space-y-4">
              {/* Фильтры для контактов */}
              {type === 'contacts' && options.contacts && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Компания
                  </label>
                  <select
                    value={filters.company || ''}
                    onChange={(e) => handleFilterChange('company', e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Все компании</option>
                    {options.contacts.companies.map((company) => (
                      <option key={company} value={company}>
                        {company}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Фильтры для задач */}
              {type === 'tasks' && options.tasks && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Статус
                  </label>
                  <select
                    value={filters.status || ''}
                    onChange={(e) => handleFilterChange('status', e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Все статусы</option>
                    {options.tasks.statuses.map((status) => (
                      <option key={status} value={status}>
                        {status === 'pending' ? 'В работе' : status === 'completed' ? 'Завершено' : status}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Фильтры для сделок */}
              {type === 'deals' && options.deals && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Этап
                    </label>
                    <select
                      value={filters.stage || ''}
                      onChange={(e) => handleFilterChange('stage', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Все этапы</option>
                      {options.deals.stages.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Валюта
                    </label>
                    <select
                      value={filters.currency || ''}
                      onChange={(e) => handleFilterChange('currency', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Все валюты</option>
                      {options.deals.currencies.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Воронка
                    </label>
                    <select
                      value={filters.pipelineId || ''}
                      onChange={(e) => handleFilterChange('pipelineId', e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Все воронки</option>
                      {options.deals.pipelines.map((pipeline) => (
                        <option key={pipeline.id} value={pipeline.id}>
                          {pipeline.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Сумма от
                    </label>
                    <input
                      type="number"
                      value={filters.minAmount || ''}
                      onChange={(e) => handleFilterChange('minAmount', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Сумма до
                    </label>
                    <input
                      type="number"
                      value={filters.maxAmount || ''}
                      onChange={(e) => handleFilterChange('maxAmount', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="∞"
                    />
                  </div>
                </>
              )}

              {/* Фильтры для событий */}
              {type === 'events' && options.events && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Тип события
                  </label>
                  <select
                    value={filters.type || ''}
                    onChange={(e) => handleFilterChange('type', e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Все типы</option>
                    {options.events.types.map((eventType) => (
                      <option key={eventType} value={eventType}>
                        {eventType === 'meeting' ? 'Встреча' : eventType === 'call' ? 'Звонок' : eventType}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Кнопки действий */}
              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={clearFilters}
                  className="flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Сбросить
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Применить
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

