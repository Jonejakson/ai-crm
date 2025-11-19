'use client'

import { useState, useEffect } from 'react'
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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

interface ActionForm {
  id: string
  type: string
  params: Record<string, any>
}

type ActionFieldType = 'text' | 'textarea' | 'number' | 'select'

interface ActionField {
  key: string
  label: string
  type: ActionFieldType
  placeholder?: string
  required?: boolean
  options?: Array<{ value: string; label: string }>
  helperText?: string
}

const ACTION_FIELD_CONFIG: Record<string, ActionField[]> = {
  SEND_EMAIL: [
    { key: 'subject', label: 'Тема письма', type: 'text', placeholder: 'Например: Спасибо за встречу', required: true },
    {
      key: 'body',
      label: 'Текст письма',
      type: 'textarea',
      placeholder: 'Вы можете использовать плейсхолдеры: {{deal.title}}, {{contact.name}}',
      required: true,
    },
  ],
  CREATE_TASK: [
    { key: 'title', label: 'Заголовок задачи', type: 'text', placeholder: 'Позвонить клиенту', required: true },
    { key: 'description', label: 'Описание', type: 'textarea', placeholder: 'Детали задачи' },
    {
      key: 'dueInDays',
      label: 'Срок (дни после события)',
      type: 'number',
      placeholder: 'Например: 2',
      helperText: '0 — в день события, 1 — на следующий день',
    },
    { key: 'assignedUserId', label: 'Назначить на пользователя', type: 'select' },
  ],
  CHANGE_PROBABILITY: [
    { key: 'probability', label: 'Новая вероятность (%)', type: 'number', placeholder: 'Например: 75', required: true },
  ],
  UPDATE_DEAL_STAGE: [
    { key: 'newStage', label: 'Новый этап сделки', type: 'text', placeholder: 'Например: negotiation', required: true },
  ],
  CREATE_NOTIFICATION: [
    { key: 'userId', label: 'Пользователь (опционально)', type: 'select' },
    { key: 'title', label: 'Заголовок', type: 'text', required: true },
    { key: 'message', label: 'Сообщение', type: 'textarea', required: true },
    {
      key: 'type',
      label: 'Тип уведомления',
      type: 'select',
      options: [
        { value: 'info', label: 'Информация' },
        { value: 'success', label: 'Успех' },
        { value: 'warning', label: 'Предупреждение' },
        { value: 'error', label: 'Ошибка' },
      ],
    },
  ],
  ASSIGN_USER: [
    { key: 'userId', label: 'Назначить на пользователя', type: 'select', required: true },
  ],
}

const generateActionId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `action-${Math.random().toString(36).slice(2)}`
}

export default function AutomationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null)
  const [users, setUsers] = useState<{ id: number; name: string; email: string }[]>([])

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
    triggerType: 'DEAL_STAGE_CHANGED',
    triggerConfig: {} as any,
    actions: [] as ActionForm[],
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
      fetchUsersList()
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

  const fetchUsersList = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (!response.ok) return
      const data = await response.json()
      setUsers(
        (data.users || []).map((user: any) => ({
          id: user.id,
          name: user.name || 'Без имени',
          email: user.email,
        }))
      )
    } catch (error) {
      console.error('Error fetching users list:', error)
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
      const url = '/api/automations'
      const method = editingAutomation ? 'PUT' : 'POST'
      const payload = {
        ...formData,
        triggerConfig: formData.triggerConfig || {},
        actions: formData.actions.map(({ id, ...rest }) => rest),
      }
      const body = editingAutomation ? { ...payload, id: editingAutomation.id } : payload

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
        actions: [] as ActionForm[],
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
      actions: (automation.actions || []).map((action: any) => ({
        id: generateActionId(),
        type: action.type,
        params: action.params || {},
      })),
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
    setFormData((prev) => ({
      ...prev,
      actions: [
        ...prev.actions,
        {
          id: generateActionId(),
          type: 'CREATE_TASK',
          params: {},
        },
      ],
    }))
  }

  const updateActionType = (actionId: string, type: string) => {
    setFormData((prev) => ({
      ...prev,
      actions: prev.actions.map((action) =>
        action.id === actionId ? { id: action.id, type, params: {} } : action
      ),
    }))
  }

  const updateActionParam = (actionId: string, key: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      actions: prev.actions.map((action) =>
        action.id === actionId
          ? { ...action, params: { ...action.params, [key]: value } }
          : action
      ),
    }))
  }

  const removeAction = (actionId: string) => {
    setFormData((prev) => ({
      ...prev,
      actions: prev.actions.filter((action) => action.id !== actionId),
    }))
  }

  const handleActionsReorder = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setFormData((prev) => {
      const oldIndex = prev.actions.findIndex((action) => action.id === active.id)
      const newIndex = prev.actions.findIndex((action) => action.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      return {
        ...prev,
        actions: arrayMove(prev.actions, oldIndex, newIndex),
      }
    })
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4" />
          <p className="text-[var(--muted)]">Загрузка автоматизаций...</p>
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
              actions: [] as ActionForm[],
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
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                      Минимальная сумма (₽)
                    </label>
                    <input
                      type="number"
                      value={formData.triggerConfig.minAmount ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          triggerConfig: {
                            ...formData.triggerConfig,
                            minAmount: e.target.value === '' ? null : Number(e.target.value),
                          },
                        })
                      }
                      className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                      Максимальная сумма (опционально)
                    </label>
                    <input
                      type="number"
                      value={formData.triggerConfig.maxAmount ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          triggerConfig: {
                            ...formData.triggerConfig,
                            maxAmount: e.target.value === '' ? null : Number(e.target.value),
                          },
                        })
                      }
                      className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
                      placeholder="Не ограничено"
                    />
                  </div>
                </div>
              )}

              {/* Действия */}
              <div className="space-y-4">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Действия *</p>
                    <p className="text-sm text-slate-500">Шаги выполняются последовательно после срабатывания триггера</p>
                  </div>
                  <button type="button" onClick={addAction} className="btn-secondary text-sm">
                    + Добавить действие
                  </button>
                </div>

                {formData.actions.length === 0 ? (
                  <div className="empty-state border border-dashed border-white/50 rounded-3xl bg-white/40 py-10">
                    <div className="empty-state-icon">⚙️</div>
                    <h3 className="empty-state-title">Нет действий</h3>
                    <p className="empty-state-description">
                      Добавьте хотя бы одно действие, чтобы автоматизация начала работать.
                    </p>
                  </div>
                ) : (
                  <DndContext collisionDetection={closestCenter} onDragEnd={handleActionsReorder}>
                    <SortableContext items={formData.actions.map((action) => action.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-4">
                        {formData.actions.map((action, index) => (
                          <SortableActionCard
                            key={action.id}
                            action={action}
                            index={index}
                            users={users}
                            onRemove={removeAction}
                            onTypeChange={updateActionType}
                            onParamChange={updateActionParam}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
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

interface SortableActionCardProps {
  action: ActionForm
  index: number
  users: { id: number; name: string; email: string }[]
  onRemove: (id: string) => void
  onTypeChange: (id: string, type: string) => void
  onParamChange: (id: string, key: string, value: any) => void
}

function SortableActionCard({
  action,
  index,
  users,
  onRemove,
  onTypeChange,
  onParamChange,
}: SortableActionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: action.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const fields = ACTION_FIELD_CONFIG[action.type] || []

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-sm backdrop-blur"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600 cursor-grab"
            {...listeners}
            {...attributes}
            aria-label="Перетащить"
          >
            ⋮⋮
          </button>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-1">Шаг {index + 1}</p>
            <select
              value={action.type}
              onChange={(e) => onTypeChange(action.id, e.target.value)}
              className="w-full rounded-2xl border border-white/50 bg-white px-4 py-2 text-sm focus:border-[var(--primary)] focus:ring-0"
            >
              {ACTION_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onRemove(action.id)}
          className="btn-secondary text-sm text-red-500 hover:text-red-600"
        >
          Удалить
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {fields.length === 0 ? (
          <p className="text-sm text-slate-500">Дополнительные параметры не требуются</p>
        ) : (
          fields.map((field) => (
            <ActionFieldControl
              key={`${action.id}-${field.key}`}
              field={field}
              value={action.params?.[field.key]}
              users={users}
              onChange={(value) => onParamChange(action.id, field.key, value)}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface ActionFieldControlProps {
  field: ActionField
  value: any
  users: { id: number; name: string; email: string }[]
  onChange: (value: any) => void
}

function ActionFieldControl({ field, value, users, onChange }: ActionFieldControlProps) {
  const inputValue = value ?? ''
  const handleNumberChange = (val: string) => {
    if (val === '') {
      onChange(null)
      return
    }
    const parsed = Number(val)
    onChange(Number.isNaN(parsed) ? null : parsed)
  }

  const label = (
    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
      {field.label}
    </label>
  )

  const helper = field.helperText ? <p className="text-xs text-slate-500">{field.helperText}</p> : null

  if (field.type === 'textarea') {
    return (
      <div>
        {label}
        <textarea
          value={inputValue}
          onChange={(e) => onChange(e.target.value)}
          rows={field.placeholder ? 4 : 3}
          placeholder={field.placeholder}
          className="w-full rounded-2xl border border-white/50 bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
          required={field.required}
        />
        {helper}
      </div>
    )
  }

  if (field.type === 'number') {
    return (
      <div>
        {label}
        <input
          type="number"
          value={inputValue}
          onChange={(e) => handleNumberChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full rounded-2xl border border-white/50 bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
          required={field.required}
        />
        {helper}
      </div>
    )
  }

  if (field.type === 'select') {
    const isUserSelect = field.key.toLowerCase().includes('userid')
    const options = isUserSelect
      ? users.map((user) => ({
          value: String(user.id),
          label: `${user.name} (${user.email})`,
        }))
      : field.options || []
    return (
      <div>
        {label}
        <select
          value={inputValue}
          onChange={(e) => {
            const val = e.target.value
            if (isUserSelect) {
              onChange(val === '' ? null : Number(val))
            } else {
              onChange(val)
            }
          }}
          className="w-full rounded-2xl border border-white/50 bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
          required={field.required}
        >
          <option value="">Не выбрано</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {helper}
      </div>
    )
  }

  return (
    <div>
      {label}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="w-full rounded-2xl border border-white/50 bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
        required={field.required}
      />
      {helper}
    </div>
  )
}
