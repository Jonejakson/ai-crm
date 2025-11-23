'use client'

import { useState, useEffect } from 'react'

interface FilterOptions {
  dateRange?: {
    start: string
    end: string
  }
  status?: string[]
  stage?: string[]
  amountRange?: {
    min: number
    max: number
  }
  tags?: number[]
  userId?: number
  pipelineId?: number
}

interface User {
  id: number
  name: string
  email: string
  role: string
}

interface Pipeline {
  id: number
  name: string
  isDefault: boolean
}

interface FiltersModalProps {
  isOpen: boolean
  onClose: () => void
  entityType: 'contacts' | 'deals' | 'tasks' | 'events'
  onFilterChange: (filters: FilterOptions) => void
  savedFilters?: Array<{ id: number; name: string; filters: FilterOptions }>
  onSaveFilter?: (name: string, filters: FilterOptions) => void
  onDeleteFilter?: (id: number) => void
  users?: User[]
  pipelines?: Pipeline[]
  selectedUserId?: number | null
  selectedPipelineId?: number | null
  onUserIdChange?: (userId: number | null) => void
  onPipelineIdChange?: (pipelineId: number | null) => void
}

export default function FiltersModal({
  isOpen,
  onClose,
  entityType,
  onFilterChange,
  savedFilters = [],
  onSaveFilter,
  onDeleteFilter,
  users = [],
  pipelines = [],
  selectedUserId,
  selectedPipelineId,
  onUserIdChange,
  onPipelineIdChange,
}: FiltersModalProps) {
  const [filters, setFilters] = useState<FilterOptions>({})
  const [quickFilter, setQuickFilter] = useState<string>('')
  const [saveFilterName, setSaveFilterName] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  // Быстрые фильтры по датам
  const quickFilters = [
    { value: 'today', label: 'Сегодня' },
    { value: 'week', label: 'Эта неделя' },
    { value: 'month', label: 'Этот месяц' },
    { value: 'quarter', label: 'Этот квартал' },
    { value: 'year', label: 'Этот год' },
  ]

  useEffect(() => {
    if (quickFilter) {
      const now = new Date()
      const start = new Date()
      const end = new Date(now)

      switch (quickFilter) {
        case 'today':
          start.setHours(0, 0, 0, 0)
          end.setHours(23, 59, 59, 999)
          break
        case 'week':
          start.setDate(now.getDate() - now.getDay())
          start.setHours(0, 0, 0, 0)
          break
        case 'month':
          start.setDate(1)
          start.setHours(0, 0, 0, 0)
          end.setMonth(now.getMonth() + 1)
          end.setDate(0)
          end.setHours(23, 59, 59, 999)
          break
        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3)
          start.setMonth(quarter * 3, 1)
          start.setHours(0, 0, 0, 0)
          end.setMonth((quarter + 1) * 3, 0)
          end.setHours(23, 59, 59, 999)
          break
        case 'year':
          start.setMonth(0, 1)
          start.setHours(0, 0, 0, 0)
          end.setMonth(11, 31)
          end.setHours(23, 59, 59, 999)
          break
      }

      setFilters(prev => ({
        ...prev,
        dateRange: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
        },
      }))
    }
  }, [quickFilter])

  useEffect(() => {
    onFilterChange(filters)
  }, [filters, onFilterChange])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const handleQuickFilter = (value: string) => {
    setQuickFilter(value === quickFilter ? '' : value)
  }

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    setFilters(prev => ({
      ...prev,
      dateRange: {
        ...prev.dateRange,
        [field]: value,
      } as any,
    }))
    setQuickFilter('')
  }

  const handleStatusChange = (status: string) => {
    setFilters(prev => {
      const statuses = prev.status || []
      const newStatuses = statuses.includes(status)
        ? statuses.filter(s => s !== status)
        : [...statuses, status]
      return { ...prev, status: newStatuses.length > 0 ? newStatuses : undefined }
    })
  }

  const handleAmountRangeChange = (field: 'min' | 'max', value: string) => {
    const numValue = value ? parseFloat(value) : undefined
    setFilters(prev => ({
      ...prev,
      amountRange: {
        ...prev.amountRange,
        [field]: numValue,
      } as any,
    }))
  }

  const clearFilters = () => {
    setFilters({})
    setQuickFilter('')
  }

  const handleSaveFilter = () => {
    if (saveFilterName && onSaveFilter) {
      onSaveFilter(saveFilterName, filters)
      setSaveFilterName('')
      setShowSaveDialog(false)
    }
  }

  const applySavedFilter = (savedFilter: FilterOptions) => {
    setFilters(savedFilter)
  }

  const hasActiveFilters = Object.keys(filters).length > 0

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center p-4 z-[99999]"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999
        }}
      >
        <div
          className="bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col z-[100000]"
          onClick={(e) => e.stopPropagation()}
          style={{
            zIndex: 100000,
            position: 'relative',
            margin: 'auto'
          }}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5 bg-gradient-to-r from-[var(--background-soft)] to-transparent">
            <h2 className="text-2xl font-bold text-[var(--foreground)]">Фильтры</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-soft)] transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Modal Body */}
          <div className="px-6 py-5 overflow-y-auto flex-1" style={{ maxHeight: 'calc(90vh - 140px)' }}>
            <div className="space-y-6">
              {/* Быстрые фильтры */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] mb-3">
                  Быстрые фильтры
                </label>
                <div className="flex flex-wrap gap-2">
                  {quickFilters.map(filter => (
                    <button
                      key={filter.value}
                      onClick={() => handleQuickFilter(filter.value)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        quickFilter === filter.value
                          ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-md'
                          : 'bg-white text-[var(--muted)] border border-[var(--border)] hover:border-[var(--primary)]'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Фильтр по воронкам (только для deals) */}
              {entityType === 'deals' && pipelines.length > 0 && onPipelineIdChange && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] mb-3">
                    Воронка
                  </label>
                  <select
                    value={selectedPipelineId || ''}
                    onChange={(e) => {
                      const value = e.target.value
                      onPipelineIdChange(value === '' ? null : parseInt(value))
                    }}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                  >
                    <option value="">Все воронки</option>
                    {pipelines.map((pipeline) => (
                      <option key={pipeline.id} value={pipeline.id}>
                        {pipeline.name} {pipeline.isDefault ? '(по умолчанию)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Фильтр по менеджерам (только для deals) */}
              {entityType === 'deals' && onUserIdChange && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] mb-3">
                    Менеджер
                  </label>
                  <select
                    value={selectedUserId || 'all'}
                    onChange={(e) => {
                      const value = e.target.value
                      onUserIdChange(value === 'all' ? null : parseInt(value))
                    }}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                    disabled={users.length === 0}
                  >
                    <option value="all">Все менеджеры</option>
                    {users.length > 0 ? (
                      users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} {user.role === 'admin' ? ' [Админ]' : user.role === 'manager' ? ' [Менеджер]' : ''}
                        </option>
                      ))
                    ) : (
                      <option value="all" disabled>Загрузка...</option>
                    )}
                  </select>
                </div>
              )}

              {/* Диапазон дат */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] mb-3">
                  Диапазон дат
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">От</label>
                    <input
                      type="date"
                      value={filters.dateRange?.start || ''}
                      onChange={(e) => handleDateRangeChange('start', e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">До</label>
                    <input
                      type="date"
                      value={filters.dateRange?.end || ''}
                      onChange={(e) => handleDateRangeChange('end', e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Фильтры по статусам */}
              {(entityType === 'tasks' || entityType === 'deals') && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] mb-3">
                    Статусы
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {entityType === 'tasks' ? (
                      <>
                        {['pending', 'in_progress', 'completed', 'cancelled'].map(status => (
                          <button
                            key={status}
                            onClick={() => handleStatusChange(status)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                              filters.status?.includes(status)
                                ? 'bg-[var(--primary)] text-white shadow-md'
                                : 'bg-white text-[var(--muted)] border border-[var(--border)] hover:border-[var(--primary)]'
                            }`}
                          >
                            {status === 'pending' ? 'В ожидании' :
                             status === 'in_progress' ? 'В работе' :
                             status === 'completed' ? 'Завершено' :
                             'Отменено'}
                          </button>
                        ))}
                      </>
                    ) : (
                      <>
                        {['lead', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'].map(stage => (
                          <button
                            key={stage}
                            onClick={() => handleStatusChange(stage)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                              filters.status?.includes(stage)
                                ? 'bg-[var(--primary)] text-white shadow-md'
                                : 'bg-white text-[var(--muted)] border border-[var(--border)] hover:border-[var(--primary)]'
                            }`}
                          >
                            {stage === 'lead' ? 'Лид' :
                             stage === 'qualification' ? 'Квалификация' :
                             stage === 'proposal' ? 'Предложение' :
                             stage === 'negotiation' ? 'Переговоры' :
                             stage === 'closed_won' ? 'Закрыто успешно' :
                             'Закрыто и не реализовано'}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Диапазон сумм (для сделок) */}
              {entityType === 'deals' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] mb-3">
                    Диапазон сумм
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-[var(--muted)] mb-1">От (₽)</label>
                      <input
                        type="number"
                        value={filters.amountRange?.min || ''}
                        onChange={(e) => handleAmountRangeChange('min', e.target.value)}
                        placeholder="0"
                        className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--muted)] mb-1">До (₽)</label>
                      <input
                        type="number"
                        value={filters.amountRange?.max || ''}
                        onChange={(e) => handleAmountRangeChange('max', e.target.value)}
                        placeholder="Без ограничений"
                        className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Сохраненные фильтры */}
              {savedFilters.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] mb-3">
                    Сохраненные фильтры
                  </label>
                  <div className="space-y-2">
                    {savedFilters.map(filter => (
                      <div
                        key={filter.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/50 border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
                      >
                        <button
                          onClick={() => applySavedFilter(filter.filters)}
                          className="flex-1 text-left text-sm font-medium text-[var(--foreground)] hover:text-[var(--primary)]"
                        >
                          {filter.name}
                        </button>
                        {onDeleteFilter && (
                          <button
                            onClick={() => onDeleteFilter(filter.id)}
                            className="ml-2 px-2 py-1 text-xs text-[var(--error)] hover:bg-[var(--error-soft)] rounded-lg transition-colors"
                          >
                            Удалить
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between border-t border-[var(--border)] px-6 py-4 bg-[var(--background-soft)]">
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 rounded-xl text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white transition-colors"
                >
                  Очистить
                </button>
              )}
              {onSaveFilter && hasActiveFilters && (
                <button
                  onClick={() => setShowSaveDialog(true)}
                  className="px-4 py-2 rounded-xl text-sm text-[var(--primary)] hover:bg-[var(--primary-soft)] transition-colors"
                >
                  💾 Сохранить фильтр
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="btn-primary text-sm"
            >
              Применить
            </button>
          </div>
        </div>
      </div>

      {/* Диалог сохранения фильтра */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/60 p-4">
          <div
            className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold text-[var(--foreground)] mb-4">Сохранить фильтр</h3>
            <input
              type="text"
              value={saveFilterName}
              onChange={(e) => setSaveFilterName(e.target.value)}
              placeholder="Название фильтра"
              className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSaveDialog(false)
                  setSaveFilterName('')
                }}
                className="flex-1 btn-secondary text-sm"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveFilter}
                disabled={!saveFilterName.trim()}
                className="flex-1 btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

