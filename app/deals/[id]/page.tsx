'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import FilesManager from '@/components/FilesManager'
import TagsManager from '@/components/TagsManager'
import CustomFieldsEditor from '@/components/CustomFieldsEditor'
import Comments from '@/components/Comments'
import toast from 'react-hot-toast'

interface Deal {
  id: number
  title: string
  amount: number
  currency: string
  stage: string
  probability: number
  expectedCloseDate: string | null
  externalId?: string | null
  syncedAt?: string | null
  createdAt: string
  updatedAt: string
  contact: {
    id: number
    name: string
    email: string
    phone: string | null
    company: string | null
    position?: string | null
  }
  source?: {
    id: number
    name: string
  } | null
  dealType?: {
    id: number
    name: string
  } | null
  user?: {
    id: number
    name: string
    email: string
  } | null
  pipeline?: {
    id: number
    name: string
  } | null
}

interface Task {
  id: number
  title: string
  description: string | null
  status: string
  dueDate: string | null
  createdAt: string
  user?: {
    id: number
    name: string
  } | null
}

interface ActivityLog {
  id: number
  entityType: string
  entityId: number
  action: string
  description: string | null
  metadata: any
  user: {
    id: number
    name: string
    email: string
  } | null
  createdAt: string
}

export default function DealDetailPage() {
  const params = useParams()
  const router = useRouter()
  const dealId = params.id
  const { data: session } = useSession()

  const [deal, setDeal] = useState<Deal | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    dueTime: '',
    status: 'pending'
  })
  const [editFormData, setEditFormData] = useState({
    title: '',
    amount: '',
    currency: 'RUB',
    stage: '',
    sourceId: '',
    dealTypeId: '',
  })

  useEffect(() => {
    if (dealId) {
      fetchDealData()
    }
  }, [dealId])

  const fetchDealData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/deals/${dealId}`)
      if (response.ok) {
        const data = await response.json()
        setDeal(data)
        setEditFormData({
          title: data.title,
          amount: data.amount.toString(),
          currency: data.currency,
          stage: data.stage,
          sourceId: data.source?.id?.toString() || '',
          dealTypeId: data.dealType?.id?.toString() || '',
        })
      } else {
        toast.error('Сделка не найдена')
        router.push('/deals')
      }
      
      // Загружаем задачи по контакту сделки и активность только если сделка найдена
      if (data && data.contact?.id) {
        // Загружаем задачи по контакту сделки
        const tasksResponse = await fetch(`/api/tasks`)
        if (tasksResponse.ok) {
          const tasksData = await tasksResponse.json()
          // Фильтруем задачи по contactId
          const filteredTasks = Array.isArray(tasksData) 
            ? tasksData.filter((task: any) => task.contactId === data.contact.id)
            : []
          setTasks(filteredTasks)
        }
        
        // Загружаем активность
        try {
          const activityResponse = await fetch(`/api/activity?entityType=deal&entityId=${dealId}`)
          if (activityResponse.ok) {
            const activityData = await activityResponse.json()
            setActivityLogs(Array.isArray(activityData?.logs) ? activityData.logs : [])
          }
        } catch (error) {
          console.error('Error fetching activity:', error)
        }
      }
    } catch (error) {
      console.error('Error fetching deal data:', error)
      toast.error('Ошибка загрузки данных сделки')
    } finally {
      setLoading(false)
    }
  }

  const buildTaskDueDate = (date: string, time: string) => {
    if (!date) return null
    if (!time) return date
    return `${date}T${time}`
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskFormData.title.trim() || !deal) return

    try {
      const dueDateValue = buildTaskDueDate(taskFormData.dueDate, taskFormData.dueTime)
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: taskFormData.title,
          description: taskFormData.description || '',
          contactId: deal.contact.id,
          dueDate: dueDateValue,
          status: taskFormData.status
        }),
      })

      if (response.ok) {
        setIsTaskModalOpen(false)
        setTaskFormData({ title: '', description: '', dueDate: '', dueTime: '', status: 'pending' })
        toast.success('Задача создана')
        fetchDealData()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка создания задачи')
      }
    } catch (error) {
      console.error('Error creating task:', error)
      toast.error('Ошибка создания задачи')
    }
  }

  const handleUpdateTaskStatus = async (taskId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (response.ok) {
        toast.success('Статус задачи обновлен')
        fetchDealData()
      }
    } catch (error) {
      console.error('Error updating task:', error)
      toast.error('Ошибка обновления задачи')
    }
  }

  const handleExportToMoysklad = async () => {
    if (!deal) return
    try {
      const response = await fetch('/api/accounting/moysklad/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id }),
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(data.message || 'Выгружено в МойСклад')
        fetchDealData()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при выгрузке в МойСклад')
      }
    } catch (error) {
      console.error('Error exporting to Moysklad:', error)
      toast.error('Ошибка при выгрузке в МойСклад')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
          <p className="text-[var(--muted)]">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (!deal) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-[var(--muted)] mb-4">Сделка не найдена</p>
          <Link href="/deals" className="btn-primary">
            Вернуться к сделкам
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Шапка */}
      <div className="bg-white border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/deals" className="text-[var(--muted)] hover:text-[var(--foreground)]">
                ← Назад к сделкам
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-[var(--foreground)]">{deal.title}</h1>
                <p className="text-sm text-[var(--muted)]">
                  {deal.amount.toLocaleString('ru-RU')} {deal.currency} • {deal.stage}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportToMoysklad}
                disabled={!!deal.externalId}
                className="btn-secondary text-sm"
                title={deal.externalId ? 'Уже выгружено в МойСклад' : 'Выгрузить контакт и заказ в МойСклад'}
              >
                {deal.externalId ? '✓ Выгружено в МойСклад' : 'Выгрузить в МойСклад'}
              </button>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="btn-primary text-sm"
              >
                Редактировать
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Основной контент - двухколоночный layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Левая колонка - Информация о клиенте */}
          <div className="lg:col-span-1 space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Клиент</h2>
              <div className="space-y-4">
                <div>
                  <Link 
                    href={`/contacts/${deal.contact.id}`}
                    className="text-xl font-semibold text-[var(--primary)] hover:underline"
                  >
                    {deal.contact.name}
                  </Link>
                </div>
                {deal.contact.email && (
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Email</label>
                    <p className="text-[var(--foreground)]">{deal.contact.email}</p>
                  </div>
                )}
                {deal.contact.phone && (
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Телефон</label>
                    <p className="text-[var(--foreground)]">{deal.contact.phone}</p>
                  </div>
                )}
                {deal.contact.company && (
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Компания</label>
                    <p className="text-[var(--foreground)]">{deal.contact.company}</p>
                  </div>
                )}
                {deal.contact.position && (
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Должность</label>
                    <p className="text-[var(--foreground)]">{deal.contact.position}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Информация о сделке</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Сумма</label>
                  <p className="text-lg font-semibold text-[var(--foreground)]">
                    {deal.amount.toLocaleString('ru-RU')} {deal.currency}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Этап</label>
                  <p className="text-[var(--foreground)]">{deal.stage}</p>
                </div>
                {deal.source && (
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Источник</label>
                    <p className="text-[var(--foreground)]">{deal.source.name}</p>
                  </div>
                )}
                {deal.dealType && (
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Тип сделки</label>
                    <p className="text-[var(--foreground)]">{deal.dealType.name}</p>
                  </div>
                )}
                {deal.user && (
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Ответственный</label>
                    <p className="text-[var(--foreground)]">{deal.user.name}</p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Вероятность</label>
                  <p className="text-[var(--foreground)]">{deal.probability}%</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Создана</label>
                  <p className="text-[var(--foreground)]">
                    {new Date(deal.createdAt).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Теги</h2>
              <TagsManager
                entityType="deal"
                entityId={deal.id}
              />
            </div>
          </div>

          {/* Правая колонка - Задачи, файлы, комментарии */}
          <div className="lg:col-span-2 space-y-6">
            {/* Задачи */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Задачи</h2>
                <button
                  onClick={() => setIsTaskModalOpen(true)}
                  className="btn-primary text-sm"
                >
                  + Создать задачу
                </button>
              </div>
              <div className="space-y-3">
                {tasks.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Нет задач</p>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-4 border border-[var(--border)] rounded-lg hover:bg-[var(--background-soft)] transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={task.status === 'completed'}
                              onChange={(e) => {
                                handleUpdateTaskStatus(task.id, e.target.checked ? 'completed' : 'pending')
                              }}
                              className="w-4 h-4"
                            />
                            <h3 className={`font-medium ${task.status === 'completed' ? 'line-through text-[var(--muted)]' : 'text-[var(--foreground)]'}`}>
                              {task.title}
                            </h3>
                          </div>
                          {task.description && (
                            <p className="text-sm text-[var(--muted)] mb-2">{task.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
                            {task.dueDate && (
                              <span>
                                {new Date(task.dueDate).toLocaleDateString('ru-RU')}
                              </span>
                            )}
                            {task.user && (
                              <span>{task.user.name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Комментарии */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Комментарии</h2>
              <Comments
                entityType="deal"
                entityId={deal.id}
              />
            </div>

            {/* Файлы */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Файлы</h2>
              <FilesManager
                entityType="deal"
                entityId={deal.id}
              />
            </div>

            {/* Дополнительные поля */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Дополнительные поля</h2>
              <CustomFieldsEditor
                entityType="deal"
                entityId={deal.id}
              />
            </div>

            {/* История активности */}
            {activityLogs.length > 0 && (
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">История активности</h2>
                <div className="space-y-3">
                  {activityLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 border-l-2 border-[var(--primary-soft)] bg-[var(--background-soft)] rounded"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-[var(--foreground)]">{log.description || log.action}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted)]">
                            {log.user && <span>{log.user.name}</span>}
                            <span>•</span>
                            <span>{new Date(log.createdAt).toLocaleString('ru-RU')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Модальное окно создания задачи */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6 border-b">
              <h3 className="text-xl font-semibold">Создать задачу</h3>
            </div>
            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Название *
                </label>
                <input
                  type="text"
                  value={taskFormData.title}
                  onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                  required
                  className="w-full"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Описание
                </label>
                <textarea
                  value={taskFormData.description}
                  onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                  rows={3}
                  className="w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Дата
                  </label>
                  <input
                    type="date"
                    value={taskFormData.dueDate}
                    onChange={(e) => setTaskFormData({ ...taskFormData, dueDate: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Время
                  </label>
                  <input
                    type="time"
                    value={taskFormData.dueTime}
                    onChange={(e) => setTaskFormData({ ...taskFormData, dueTime: e.target.value })}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="btn-secondary"
                >
                  Отмена
                </button>
                <button type="submit" className="btn-primary">
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

