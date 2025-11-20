'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface Pipeline {
  id: number
  name: string
  stages: string
  isDefault: boolean
}

interface PipelineManagerProps {
  pipelines: Pipeline[]
  onPipelinesChange: () => void
  onSelectPipeline: (pipelineId: number) => void
  selectedPipelineId: number | null
}

export default function PipelineManager({ 
  pipelines, 
  onPipelinesChange, 
  onSelectPipeline,
  selectedPipelineId 
}: PipelineManagerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    stages: DEFAULT_STAGES
  })

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Введите название воронки')
      return
    }

    try {
      const response = await fetch('/api/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          stages: JSON.stringify(formData.stages),
          isDefault: false
        })
      })

      if (response.ok) {
        toast.success('Воронка создана')
        setIsCreating(false)
        setFormData({ name: '', stages: DEFAULT_STAGES })
        onPipelinesChange()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при создании воронки')
      }
    } catch (error) {
      console.error('Error creating pipeline:', error)
      toast.error('Ошибка при создании воронки')
    }
  }

  const handleUpdate = async () => {
    if (!editingPipeline || !formData.name.trim()) {
      toast.error('Введите название воронки')
      return
    }

    try {
      const response = await fetch('/api/pipelines', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPipeline.id,
          name: formData.name.trim(),
          stages: JSON.stringify(formData.stages)
        })
      })

      if (response.ok) {
        toast.success('Воронка обновлена')
        setEditingPipeline(null)
        setFormData({ name: '', stages: DEFAULT_STAGES })
        onPipelinesChange()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при обновлении воронки')
      }
    } catch (error) {
      console.error('Error updating pipeline:', error)
      toast.error('Ошибка при обновлении воронки')
    }
  }

  const handleDelete = async (pipelineId: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту воронку? Сделки из этой воронки будут перемещены в дефолтную.')) {
      return
    }

    try {
      const response = await fetch(`/api/pipelines/${pipelineId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Воронка удалена')
        if (selectedPipelineId === pipelineId) {
          const defaultPipeline = pipelines.find(p => p.id !== pipelineId && p.isDefault) || pipelines.find(p => p.id !== pipelineId)
          if (defaultPipeline) {
            onSelectPipeline(defaultPipeline.id)
          }
        }
        onPipelinesChange()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при удалении воронки')
      }
    } catch (error) {
      console.error('Error deleting pipeline:', error)
      toast.error('Ошибка при удалении воронки')
    }
  }

  const handleSetDefault = async (pipelineId: number) => {
    try {
      const response = await fetch('/api/pipelines', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: pipelineId,
          isDefault: true
        })
      })

      if (response.ok) {
        toast.success('Воронка установлена как дефолтная')
        onPipelinesChange()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при установке дефолтной воронки')
      }
    } catch (error) {
      console.error('Error setting default pipeline:', error)
      toast.error('Ошибка при установке дефолтной воронки')
    }
  }

  const startEdit = (pipeline: Pipeline) => {
    setEditingPipeline(pipeline)
    setFormData({
      name: pipeline.name,
      stages: typeof pipeline.stages === 'string' ? JSON.parse(pipeline.stages) : pipeline.stages
    })
  }

  // Блокируем скролл body при открытом модальном окне
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Закрытие по ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        setIsCreating(false)
        setEditingPipeline(null)
        setFormData({ name: '', stages: DEFAULT_STAGES })
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-secondary text-sm flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Управление воронками
      </button>

      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4" 
          onClick={() => setIsOpen(false)}
          style={{ 
            isolation: 'isolate', 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            zIndex: 9999
          }}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden relative animate-scaleIn" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              zIndex: 10000, 
              isolation: 'isolate', 
              position: 'relative',
              margin: 'auto'
            }}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5 bg-gradient-to-r from-[var(--background-soft)] to-transparent">
              <h2 className="text-2xl font-bold text-[var(--foreground)]">Управление воронками</h2>
              <button
                onClick={() => {
                  setIsOpen(false)
                  setIsCreating(false)
                  setEditingPipeline(null)
                  setFormData({ name: '', stages: DEFAULT_STAGES })
                }}
                className="p-2 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-soft)] transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 100px)' }}>
              <div className="space-y-4">
                {/* Список воронок */}
                <div className="space-y-3">
                  {pipelines.map((pipeline) => (
                    <div
                      key={pipeline.id}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                        selectedPipelineId === pipeline.id
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                          : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary-soft)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-[var(--foreground)]">{pipeline.name}</h3>
                            {pipeline.isDefault && (
                              <span className="badge-primary text-xs">По умолчанию</span>
                            )}
                            {selectedPipelineId === pipeline.id && (
                              <span className="badge-success text-xs">Активна</span>
                            )}
                          </div>
                          <p className="text-sm text-[var(--muted)]">
                            {(() => {
                              const stages = typeof pipeline.stages === 'string' 
                                ? JSON.parse(pipeline.stages) 
                                : pipeline.stages;
                              return Array.isArray(stages) ? stages.length : 0;
                            })()} этапов
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectPipeline(pipeline.id)
                              setIsOpen(false)
                            }}
                            className="px-3 py-1.5 text-sm rounded-lg bg-[var(--background-soft)] hover:bg-[var(--primary-soft)] text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
                          >
                            Выбрать
                          </button>
                          {!pipeline.isDefault && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSetDefault(pipeline.id)
                              }}
                              className="px-3 py-1.5 text-sm rounded-lg bg-[var(--background-soft)] hover:bg-[var(--primary-soft)] text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
                              title="Установить по умолчанию"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              startEdit(pipeline)
                            }}
                            className="px-3 py-1.5 text-sm rounded-lg bg-[var(--background-soft)] hover:bg-[var(--primary-soft)] text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
                            title="Редактировать"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {pipelines.length > 1 && !pipeline.isDefault && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(pipeline.id)
                              }}
                              className="px-3 py-1.5 text-sm rounded-lg bg-[var(--error-soft)] hover:bg-[var(--error)] text-[var(--error)] hover:text-white transition-colors"
                              title="Удалить"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Форма создания/редактирования */}
                {(isCreating || editingPipeline) && (
                  <div className="p-4 rounded-xl border-2 border-[var(--primary-soft)] bg-[var(--background-soft)]">
                    <h3 className="font-semibold text-[var(--foreground)] mb-4">
                      {editingPipeline ? 'Редактировать воронку' : 'Создать новую воронку'}
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                          Название воронки
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Например: Продажи, Маркетинг, Поддержка"
                          className="w-full"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={editingPipeline ? handleUpdate : handleCreate}
                          className="btn-primary flex-1"
                        >
                          {editingPipeline ? 'Сохранить' : 'Создать'}
                        </button>
                        <button
                          onClick={() => {
                            setIsCreating(false)
                            setEditingPipeline(null)
                            setFormData({ name: '', stages: DEFAULT_STAGES })
                          }}
                          className="btn-secondary"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Кнопка создания */}
                {!isCreating && !editingPipeline && (
                  <button
                    onClick={() => setIsCreating(true)}
                    className="w-full btn-primary flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Создать новую воронку
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const DEFAULT_STAGES = [
  'Первичный контакт',
  'Коммерческое предложение',
  'Согласование',
  'Передача в производство',
  'Скомплектовано на Складе',
  'Закрыто и реализованное',
  'Закрыто пропала потребность'
]

