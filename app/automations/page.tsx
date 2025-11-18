'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Automation {
  id: number
  name: string
  description: string | null
  isActive: boolean
  triggerType: string
  triggerConfig: any
  actions: any[]
  createdAt: string
  updatedAt: string
}

const TRIGGER_TYPES = [
  { value: 'DEAL_STAGE_CHANGED', label: 'Изменение этапа сделки' },
  { value: 'DEAL_CREATED', label: 'Создание сделки' },
  { value: 'DEAL_AMOUNT_CHANGED', label: 'Изменение суммы сделки' },
  { value: 'TASK_CREATED', label: 'Создание задачи' },
  { value: 'TASK_COMPLETED', label: 'Завершение задачи' },
  { value: 'CONTACT_CREATED', label: 'Создание контакта' },
  { value: 'EVENT_CREATED', label: 'Создание события' },
]

const ACTION_TYPES = [
  { value: 'CREATE_TASK', label: 'Создать задачу' },
  { value: 'SEND_EMAIL', label: 'Отправить письмо' },
  { value: 'CHANGE_PROBABILITY', label: 'Изменить вероятность' },
  { value: 'ASSIGN_USER', label: 'Назначить пользователя' },
  { value: 'CREATE_NOTIFICATION', label: 'Создать уведомление' },
  { value: 'UPDATE_DEAL_STAGE', label: 'Изменить этап сделки' },
]

export default function AutomationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
    triggerType: 'DEAL_STAGE_CHANGED',
    triggerConfig: {} as any,
    actions: [] as any[],
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated') {
      if (session?.user?.role !== 'admin') {
        router.push('/')
        return
      }
      fetchAutomations()
    }
  }, [status, session, router])

  const fetchAutomations = async () => {
    try {
      const response = await fetch('/api/automations')
      if (!response.ok) {
        if (response.status === 403) {
          router.push('/')
          return
        }
        throw new Error('Ошибка загрузки автоматизаций')
      }
      const data = await response.json()
      setAutomations(data.automations || [])
    } catch (error: any) {
      console.error('Error fetching automations:', error)
      setError('Ошибка загрузки автоматизаций')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.name || formData.actions.length === 0) {
      setError('Заполните название и добавьте хотя бы одно действие')
      return
    }

    try {
      const url = editingAutomation ? '/api/automations' : '/api/automations'
      const method = editingAutomation ? 'PUT' : 'POST'
      const body = editingAutomation
        ? { ...formData, id: editingAutomation.id }
        : formData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка сохранения автоматизации')
      }

      setSuccess(editingAutomation ? 'Автоматизация обновлена!' : 'Автоматизация создана!')
      setIsModalOpen(false)
      setEditingAutomation(null)
      setFormData({
        name: '',
        description: '',
        isActive: true,
        triggerType: 'DEAL_STAGE_CHANGED',
        triggerConfig: {},
        actions: [],
      })
      await fetchAutomations()
    } catch (error: any) {
      console.error('Error saving automation:', error)
      setError(error.message || 'Ошибка сохранения автоматизации')
    }
  }

  const handleEdit = (automation: Automation) => {
    setEditingAutomation(automation)
    setFormData({
      name: automation.name,
      description: automation.description || '',
      isActive: automation.isActive,
      triggerType: automation.triggerType,
      triggerConfig: automation.triggerConfig || {},
      actions: automation.actions || [],
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить автоматизацию?')) return

    try {
      const response = await fetch(`/api/automations?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Ошибка удаления автоматизации')
      }

      setSuccess('Автоматизация удалена!')
      await fetchAutomations()
    } catch (error: any) {
      console.error('Error deleting automation:', error)
      setError(error.message || 'Ошибка удаления автоматизации')
    }
  }

  const addAction = () => {
    setFormData({
      ...formData,
      actions: [...formData.actions, { type: 'CREATE_TASK', params: {} }],
    })
  }

  const updateAction = (index: number, field: string, value: any) => {
    const newActions = [...formData.actions]
    if (field === 'type') {
      newActions[index] = { type: value, params: {} }
    } else {
      newActions[index] = { ...newActions[index], params: { ...newActions[index].params, [field]: value } }
    }
    setFormData({ ...formData, actions: newActions })
  }

  const removeAction = (index: number) => {
    setFormData({
      ...formData,
      actions: formData.actions.filter((_, i) => i !== index),
    })
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (session?.user?.role !== 'admin') {
    return null
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Автоматизация</p>
          <h1 className="text-3xl font-semibold text-slate-900">Автоматизации</h1>
          <p className="text-sm text-slate-500">Настройте автоматические действия при событиях в CRM.</p>
        </div>
        <button
          onClick={() => {
            setEditingAutomation(null)
            setFormData({
              name: '',
              description: '',
              isActive: true,
              triggerType: 'DEAL_STAGE_CHANGED',
              triggerConfig: {},
              actions: [],
            })
            setIsModalOpen(true)
          }}
          className="btn-primary"
        >
          + Создать автоматизацию
        </button>
      </div>

      {error && (
        <div className="glass-panel p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800">
          {error}
        </div>
      )}
      {success && (
        <div className="glass-panel p-4 rounded-2xl bg-green-50 border border-green-200 text-green-800">
          {success}
        </div>
      )}

      <div className="glass-panel rounded-3xl overflow-hidden">
        {automations.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-500 mb-4">Нет автоматизаций</p>
            <button onClick={() => setIsModalOpen(true)} className="btn-primary">
              Создать первую автоматизацию
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/40">
            {automations.map((automation) => (
              <div key={automation.id} className="p-6 hover:bg-white/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-900">{automation.name}</h3>
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full ${
                          automation.isActive
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {automation.isActive ? 'Активна' : 'Неактивна'}
                      </span>
                    </div>
                    {automation.description && (
                      <p className="text-sm text-slate-600 mb-3">{automation.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                      <span>
                        <strong>Триггер:</strong>{' '}
                        {TRIGGER_TYPES.find((t) => t.value === automation.triggerType)?.label ||
                          automation.triggerType}
                      </span>
                      <span>
                        <strong>Действий:</strong> {automation.actions?.length || 0}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(automation)}
                      className="btn-secondary text-sm"
                    >
                      ✏️ Редактировать
                    </button>
                    <button
                      onClick={() => handleDelete(automation.id)}
                      className="btn-secondary text-sm text-red-600 hover:text-red-800"
                    >
                      🗑️ Удалить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модальное окно создания/редактирования */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/40 pb-4 mb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                  {editingAutomation ? 'Редактирование' : 'Создание'}
                </p>
                <h3 className="text-xl font-semibold text-slate-900">Автоматизация</h3>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  setEditingAutomation(null)
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Название *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
                  placeholder="Например: Уведомление при смене этапа"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Описание
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
                  placeholder="Краткое описание автоматизации"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Триггер (когда срабатывает) *
                </label>
                <select
                  value={formData.triggerType}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      triggerType: e.target.value,
                      triggerConfig: {},
                    })
                  }}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
                >
                  {TRIGGER_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Условия триггера */}
              {formData.triggerType === 'DEAL_STAGE_CHANGED' && (
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    Этап (если пусто, срабатывает на любой этап)
                  </label>
                  <input
                    type="text"
                    value={formData.triggerConfig.stage || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        triggerConfig: { ...formData.triggerConfig, stage: e.target.value },
                      })
                    }
                    className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
                    placeholder="Например: negotiation"
                  />
                </div>
              )}

              {formData.triggerType === 'DEAL_AMOUNT_CHANGED' && (
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    Минимальная сумма (₽)
                  </label>
                  <input
                    type="number"
                    value={formData.triggerConfig.minAmount || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        triggerConfig: { ...formData.triggerConfig, minAmount: parseFloat(e.target.value) || 0 },
                      })
                    }
                    className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
                    placeholder="0"
                  />
                </div>
              )}

              {/* Действия */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    Действия *
                  </label>
                  <button
                    type="button"
                    onClick={addAction}
                    className="btn-secondary text-sm"
                  >
                    + Добавить действие
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.actions.map((action, index) => (
                    <div key={index} className="card p-4">
                      <div className="flex items-start justify-between mb-3">
                        <select
                          value={action.type}
                          onChange={(e) => updateAction(index, 'type', e.target.value)}
                          className="flex-1 rounded-2xl border border-white/50 bg-white/80 px-4 py-2 text-sm focus:border-[var(--primary)] focus:ring-0 mr-2"
                        >
                          {ACTION_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeAction(index)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Параметры действий */}
                      {action.type === 'CREATE_TASK' && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Название задачи *"
                            value={action.params?.title || ''}
                            onChange={(e) => updateAction(index, 'title', e.target.value)}
                            required
                            className="w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm focus:border-[var(--primary)] focus:ring-0"
                          />
                          <textarea
                            placeholder="Описание задачи"
                            value={action.params?.description || ''}
                            onChange={(e) => updateAction(index, 'description', e.target.value)}
                            rows={2}
                            className="w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm focus:border-[var(--primary)] focus:ring-0"
                          />
                        </div>
                      )}

                      {action.type === 'SEND_EMAIL' && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Тема письма *"
                            value={action.params?.subject || ''}
                            onChange={(e) => updateAction(index, 'subject', e.target.value)}
                            required
                            className="w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm focus:border-[var(--primary)] focus:ring-0"
                          />
                          <textarea
                            placeholder="Текст письма *"
                            value={action.params?.body || ''}
                            onChange={(e) => updateAction(index, 'body', e.target.value)}
                            required
                            rows={4}
                            className="w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm focus:border-[var(--primary)] focus:ring-0"
                          />
                        </div>
                      )}

                      {action.type === 'CHANGE_PROBABILITY' && (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="Вероятность (0-100) *"
                          value={action.params?.probability || ''}
                          onChange={(e) => updateAction(index, 'probability', parseInt(e.target.value) || 0)}
                          required
                          className="w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm focus:border-[var(--primary)] focus:ring-0"
                        />
                      )}

                      {action.type === 'ASSIGN_USER' && (
                        <input
                          type="number"
                          placeholder="ID пользователя *"
                          value={action.params?.userId || ''}
                          onChange={(e) => updateAction(index, 'userId', parseInt(e.target.value) || 0)}
                          required
                          className="w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm focus:border-[var(--primary)] focus:ring-0"
                        />
                      )}

                      {action.type === 'CREATE_NOTIFICATION' && (
                        <div className="space-y-2">
                          <input
                            type="number"
                            placeholder="ID пользователя *"
                            value={action.params?.userId || ''}
                            onChange={(e) => updateAction(index, 'userId', parseInt(e.target.value) || 0)}
                            required
                            className="w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm focus:border-[var(--primary)] focus:ring-0"
                          />
                          <input
                            type="text"
                            placeholder="Заголовок *"
                            value={action.params?.title || ''}
                            onChange={(e) => updateAction(index, 'title', e.target.value)}
                            required
                            className="w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm focus:border-[var(--primary)] focus:ring-0"
                          />
                          <textarea
                            placeholder="Сообщение *"
                            value={action.params?.message || ''}
                            onChange={(e) => updateAction(index, 'message', e.target.value)}
                            required
                            rows={2}
                            className="w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm focus:border-[var(--primary)] focus:ring-0"
                          />
                        </div>
                      )}

                      {action.type === 'UPDATE_DEAL_STAGE' && (
                        <input
                          type="text"
                          placeholder="Название этапа *"
                          value={action.params?.stage || ''}
                          onChange={(e) => updateAction(index, 'stage', e.target.value)}
                          required
                          className="w-full rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm focus:border-[var(--primary)] focus:ring-0"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-white/50"
                  />
                  <span className="text-sm text-slate-700">Активна</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/40">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setEditingAutomation(null)
                  }}
                  className="btn-secondary text-sm"
                >
                  Отмена
                </button>
                <button type="submit" className="btn-primary text-sm">
                  {editingAutomation ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

