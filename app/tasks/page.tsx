'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import UserFilter from '@/components/UserFilter'
import AdvancedFilters from '@/components/AdvancedFilters'
import FilesManager from '@/components/FilesManager'
import Comments from '@/components/Comments'
import CustomFieldsEditor from '@/components/CustomFieldsEditor'
import Skeleton, { SkeletonKanban } from '@/components/Skeleton'
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Task {
  id: number
  title: string
  description: string | null
  status: string
  dueDate: string | null
  createdAt: string
  contactId: number | null
  contact?: {
    id: number
    name: string
    email: string
  }
  user?: {
    id: number
    name: string
    email: string
  }
}

interface Contact {
  id: number
  name: string
  email: string
}

// Определяем категории задач по датам
const TASK_CATEGORIES = [
  { id: 'overdue', name: 'Просроченные', color: 'from-[#ffe7e7] via-[#fff1f1] to-white shadow-[0_25px_35px_-25px_rgba(239,68,68,0.45)]' },
  { id: 'today', name: 'Сегодня', color: 'from-[#fff0da] via-[#fff8ec] to-white shadow-[0_25px_35px_-25px_rgba(234,179,8,0.45)]' },
  { id: 'tomorrow', name: 'Завтра', color: 'from-[#fff4e5] via-[#fff9f1] to-white shadow-[0_25px_35px_-25px_rgba(249,115,22,0.45)]' },
  { id: 'next_week', name: 'Следующая неделя', color: 'from-[#e6f2ff] via-[#eff6ff] to-white shadow-[0_25px_35px_-25px_rgba(59,130,246,0.35)]' },
  { id: 'next_month', name: 'Следующий месяц', color: 'from-[#f0ecff] via-[#f6f2ff] to-white shadow-[0_25px_35px_-25px_rgba(129,140,248,0.35)]' },
  { id: 'no_date', name: 'Без даты', color: 'from-[#edf2f7] via-[#f5f7fb] to-white shadow-[0_25px_35px_-25px_rgba(148,163,184,0.35)]' },
]

// Функция для определения категории задачи по дате
function getTaskCategory(dueDate: string | null): string {
  if (!dueDate) return 'no_date'
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const taskDate = new Date(dueDate)
  taskDate.setHours(0, 0, 0, 0)
  
  const diffTime = taskDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'tomorrow'
  if (diffDays >= 2 && diffDays <= 7) return 'next_week'
  if (diffDays > 7 && diffDays <= 30) return 'next_month'
  return 'no_date'
}

// Функция для получения даты из категории
function getDateFromCategory(categoryId: string): Date | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  switch (categoryId) {
    case 'today':
      return today
    case 'tomorrow':
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      return tomorrow
    case 'next_week':
      const nextWeek = new Date(today)
      nextWeek.setDate(nextWeek.getDate() + 3) // Середина недели
      return nextWeek
    case 'next_month':
      const nextMonth = new Date(today)
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      return nextMonth
    case 'overdue':
      const overdue = new Date(today)
      overdue.setDate(overdue.getDate() - 1)
      return overdue
    default:
      return null
  }
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [viewingTask, setViewingTask] = useState<Task | null>(null)
  const [taskViewTab, setTaskViewTab] = useState<'info' | 'comments' | 'custom-fields' | 'files'>('info')
  const [filters, setFilters] = useState<any>({})
  const [savedFilters, setSavedFilters] = useState<Array<{ id: number; name: string; filters: any }>>([])
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    contactId: '',
    status: 'pending'
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    fetchData()
    checkNotifications()
    // Загружаем сохраненные фильтры из localStorage
    const saved = localStorage.getItem('savedFilters_tasks')
    if (saved) {
      try {
        setSavedFilters(JSON.parse(saved))
      } catch (e) {
        console.error('Error loading saved filters:', e)
      }
    }
  }, [selectedUserId])

  const checkNotifications = async () => {
    try {
      await fetch('/api/notifications/check', { method: 'POST' })
    } catch (error) {
      console.error('Error checking notifications:', error)
    }
  }

  const fetchData = async () => {
    try {
      const tasksUrl = selectedUserId 
        ? `/api/tasks?userId=${selectedUserId}` 
        : '/api/tasks'
      const contactsUrl = selectedUserId 
        ? `/api/contacts?userId=${selectedUserId}` 
        : '/api/contacts'
      
      const [tasksRes, contactsRes] = await Promise.all([
        fetch(tasksUrl).then(res => res.json()),
        fetch(contactsUrl).then(res => res.json())
      ])
      setTasks(tasksRes)
      setContacts(contactsRes)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          contactId: formData.contactId ? Number(formData.contactId) : null,
          dueDate: formData.dueDate || null
        }),
      })

      if (response.ok) {
        await fetchData()
        setIsModalOpen(false)
        setFormData({
          title: '',
          description: '',
          dueDate: '',
          contactId: '',
          status: 'pending'
        })
        toast.success('Задача успешно создана')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при создании задачи')
      }
    } catch (error) {
      console.error('Error creating task:', error)
      toast.error('Ошибка при создании задачи')
    }
  }

  const handleTaskDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    setActiveTask(null)

    if (!over) {
      return
    }

    const taskId = parseInt(active.id as string)
    const newCategoryId = over.id as string

    const task = tasks.find(t => t.id === taskId)
    if (!task) {
      console.error('Task not found:', taskId)
      return
    }

    // Получаем новую дату из категории
    const newDate = getDateFromCategory(newCategoryId)
    const newDueDate = newDate ? newDate.toISOString().split('T')[0] : null

    // Если дата не изменилась, ничего не делаем
    const currentDueDate = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : null
    if (currentDueDate === newDueDate) {
      return
    }

    // Оптимистично обновляем UI
    setTasks(prevTasks => 
      prevTasks.map(t => 
        t.id === taskId ? { ...t, dueDate: newDueDate } : t
      )
    )

    try {
      const response = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: taskId,
          title: task.title,
          description: task.description,
          dueDate: newDueDate,
          status: task.status,
          contactId: task.contactId,
        }),
      })

      if (response.ok) {
        await fetchData()
        toast.success('Статус задачи обновлен')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при обновлении задачи')
        await fetchData()
      }
    } catch (error) {
      console.error('Error updating task:', error)
      toast.error('Ошибка при обновлении задачи')
      await fetchData()
    }
  }

  const handleDelete = async (taskId: number) => {
    if (!confirm('Удалить задачу?')) return

    try {
      const response = await fetch(`/api/tasks?id=${taskId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchData()
        toast.success('Задача успешно удалена')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при удалении задачи')
      }
    } catch (error) {
      console.error('Error deleting task:', error)
      toast.error('Ошибка при удалении задачи')
    }
  }

  const handleStatusChange = async (taskId: number, newStatus: string) => {
    try {
      const taskToUpdate = tasks.find(t => t.id === taskId)
      if (!taskToUpdate) return

      const response = await fetch('/api/tasks', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: taskId,
          status: newStatus,
          title: taskToUpdate.title,
          description: taskToUpdate.description,
          dueDate: taskToUpdate.dueDate,
          contactId: taskToUpdate.contactId
        }),
      })

      if (response.ok) {
        await fetchData()
        toast.success('Статус задачи обновлен')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при обновлении задачи')
      }
    } catch (error) {
      console.error('Error updating task:', error)
      toast.error('Ошибка при обновлении задачи')
    }
  }

  // Применяем фильтры к задачам
  const filteredTasks = tasks.filter(task => {
    // Фильтр по статусам
    if (filters.status && filters.status.length > 0) {
      if (!filters.status.includes(task.status)) return false
    }

    // Фильтр по дате создания
    if (filters.dateRange) {
      const taskDate = new Date(task.createdAt || new Date())
      const startDate = filters.dateRange.start ? new Date(filters.dateRange.start) : null
      const endDate = filters.dateRange.end ? new Date(filters.dateRange.end) : null
      
      if (startDate && taskDate < startDate) return false
      if (endDate) {
        const endDateEnd = new Date(endDate)
        endDateEnd.setHours(23, 59, 59, 999)
        if (taskDate > endDateEnd) return false
      }
    }

    // Фильтр по сроку выполнения
    if (filters.dueDateRange && task.dueDate) {
      const dueDate = new Date(task.dueDate)
      const startDate = filters.dueDateRange.start ? new Date(filters.dueDateRange.start) : null
      const endDate = filters.dueDateRange.end ? new Date(filters.dueDateRange.end) : null
      
      if (startDate && dueDate < startDate) return false
      if (endDate) {
        const endDateEnd = new Date(endDate)
        endDateEnd.setHours(23, 59, 59, 999)
        if (dueDate > endDateEnd) return false
      }
    }

    return true
  })

  // Распределяем задачи по категориям
  const tasksByCategory = TASK_CATEGORIES.reduce((acc, category) => {
    acc[category.id] = filteredTasks.filter(task => getTaskCategory(task.dueDate) === category.id)
    return acc
  }, {} as Record<string, Task[]>)

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <Skeleton variant="text" width={200} height={32} />
            <Skeleton variant="text" width={400} height={16} />
          </div>
          <div className="flex gap-3">
            <Skeleton variant="rectangular" width={120} height={40} />
            <Skeleton variant="rectangular" width={150} height={40} />
          </div>
        </div>
        <SkeletonKanban />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Задачи</p>
          <h1 className="text-3xl font-semibold text-slate-900">Лента задач</h1>
          <p className="text-sm text-slate-500">Следите за сроками, перетаскивайте карточки между категориями и изменяйте статус.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => {
              window.location.href = '/api/export/tasks?format=excel'
            }}
            className="btn-secondary flex items-center gap-2"
          >
            📥 Экспорт CSV
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary"
          >
            + Новая задача
          </button>
        </div>
      </div>
      
      <div className="glass-panel px-6 py-5 rounded-3xl space-y-4">
        <UserFilter 
          selectedUserId={selectedUserId} 
          onUserChange={setSelectedUserId} 
        />
        <AdvancedFilters
          entityType="tasks"
          onFilterChange={setFilters}
          savedFilters={savedFilters}
          onSaveFilter={(name, filterData) => {
            const newFilter = {
              id: Date.now(),
              name,
              filters: filterData,
            }
            const updated = [...savedFilters, newFilter]
            setSavedFilters(updated)
            localStorage.setItem('savedFilters_tasks', JSON.stringify(updated))
          }}
          onDeleteFilter={(id) => {
            const updated = savedFilters.filter(f => f.id !== id)
            setSavedFilters(updated)
            localStorage.setItem('savedFilters_tasks', JSON.stringify(updated))
          }}
        />
      </div>

      <div className="glass-panel p-6 rounded-3xl">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={handleTaskDragEnd}
          onDragStart={(event) => {
            const task = tasks.find(t => t.id === parseInt(event.active.id as string))
            setActiveTask(task || null)
          }}
          onDragCancel={() => setActiveTask(null)}
        >
          <div className="overflow-x-auto">
            <div className="flex space-x-4 min-w-max pb-4">
              {TASK_CATEGORIES.map((category) => (
                <TaskColumn
                  key={category.id}
                  category={category}
                  tasks={tasksByCategory[category.id] || []}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                  onView={setViewingTask}
                />
              ))}
            </div>
          </div>
          <DragOverlay>
            {activeTask ? (
              <div className="bg-white rounded-lg p-3 shadow-lg border border-gray-200 w-64">
                <h4 className="font-medium text-gray-900 text-sm">{activeTask.title}</h4>
                {activeTask.contact && (
                  <div className="text-xs text-gray-600 mt-1">{activeTask.contact.name}</div>
                )}
                {activeTask.dueDate && (
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(activeTask.dueDate).toLocaleDateString('ru-RU')}
                  </div>
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Модальное окно создания задачи */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)] font-semibold mb-1">Новая задача</p>
                <h3 className="text-2xl font-bold text-[var(--foreground)]">Создать задачу</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-2 hover:bg-[var(--background-soft)] rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Название задачи *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  required
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Описание
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={4}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Срок выполнения
                  </label>
                  <input
                    type="date"
                    name="dueDate"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Связать с клиентом
                  </label>
                  <select
                    name="contactId"
                    value={formData.contactId}
                    onChange={(e) => setFormData({...formData, contactId: e.target.value})}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                  >
                    <option value="">Без клиента</option>
                    {contacts.map(contact => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name} ({contact.email || 'без email'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn-primary text-sm btn-ripple"
                >
                  Создать задачу
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно просмотра деталей задачи */}
      {viewingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-xl font-semibold">{viewingTask.title}</h3>
              <button
                onClick={() => {
                  setViewingTask(null)
                  setTaskViewTab('info')
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Вкладки */}
            <div className="flex border-b">
              <button
                onClick={() => setTaskViewTab('info')}
                className={`px-6 py-3 font-medium ${
                  taskViewTab === 'info'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Информация
              </button>
              <button
                onClick={() => setTaskViewTab('comments')}
                className={`px-6 py-3 font-medium ${
                  taskViewTab === 'comments'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Комментарии
              </button>
              <button
                onClick={() => setTaskViewTab('custom-fields')}
                className={`px-6 py-3 font-medium ${
                  taskViewTab === 'custom-fields'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Доп. поля
              </button>
              <button
                onClick={() => setTaskViewTab('files')}
                className={`px-6 py-3 font-medium ${
                  taskViewTab === 'files'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Файлы
              </button>
            </div>

            {/* Содержимое вкладок */}
            <div className="flex-1 overflow-y-auto p-6">
              {taskViewTab === 'info' && (
                <div className="space-y-4">
                  {viewingTask.description && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Описание
                      </label>
                      <p className="text-gray-900 whitespace-pre-wrap">{viewingTask.description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Статус
                      </label>
                      <p className="text-gray-900">
                        {viewingTask.status === 'completed' ? 'Завершена' : 
                         viewingTask.status === 'in_progress' ? 'В работе' : 'Ожидает'}
                      </p>
                    </div>
                    {viewingTask.dueDate && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Срок выполнения
                        </label>
                        <p className="text-gray-900">
                          {new Date(viewingTask.dueDate).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                    )}
                  </div>
                  {viewingTask.contact && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Клиент
                      </label>
                      <p className="text-gray-900">
                        <a
                          href={`/contacts/${viewingTask.contact.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {viewingTask.contact.name}
                        </a>
                      </p>
                    </div>
                  )}
                  {viewingTask.user && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ответственный
                      </label>
                      <p className="text-gray-900">{viewingTask.user.name}</p>
                    </div>
                  )}
                </div>
              )}

              {taskViewTab === 'comments' && viewingTask && (
                <Comments
                  entityType="task"
                  entityId={viewingTask.id}
                />
              )}

              {taskViewTab === 'custom-fields' && viewingTask && (
                <CustomFieldsEditor
                  entityType="task"
                  entityId={viewingTask.id}
                  onSave={() => {
                    // Обновить данные задачи при необходимости
                  }}
                />
              )}

              {taskViewTab === 'files' && viewingTask && (
                <FilesManager
                  entityType="task"
                  entityId={viewingTask.id}
                />
              )}
            </div>

            <div className="p-6 border-t flex justify-end">
              <button
                onClick={() => {
                  setViewingTask(null)
                  setTaskViewTab('info')
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Компонент колонки с drag & drop для задач
function TaskColumn({ 
  category, 
  tasks, 
  onDelete,
  onStatusChange,
  onView
}: { 
  category: { id: string; name: string; color: string }
  tasks: Task[]
  onDelete: (id: number) => void
  onStatusChange: (id: number, status: string) => void
  onView?: (task: Task) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: category.id,
  })

  return (
    <div 
      ref={setNodeRef}
      className={`kanban-column flex-shrink-0 w-72 bg-gradient-to-b ${category.color} ${isOver ? 'ring-2 ring-[var(--primary)]/40' : ''}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Категория</p>
          <h3 className="text-lg font-semibold text-slate-900">{category.name}</h3>
        </div>
        <span className="text-sm font-semibold text-slate-500">{tasks.length}</span>
      </div>
      <div className="space-y-3 min-h-[120px]">
        {tasks.map((task) => (
          <TaskCard 
            key={task.id} 
            task={task} 
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            onView={onView}
          />
        ))}
      </div>
    </div>
  )
}

// Компонент карточки задачи с drag & drop
function TaskCard({ task, onDelete, onStatusChange, onView }: { task: Task; onDelete: (id: number) => void; onStatusChange: (id: number, status: string) => void; onView?: (task: Task) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: task.id.toString(),
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'pending': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Завершена'
      case 'in_progress': return 'В работе'
      case 'pending': return 'Ожидает'
      default: return status
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="group relative overflow-hidden rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur cursor-grab active:cursor-grabbing transition-all hover:shadow-2xl"
    >
      <div className="absolute inset-x-4 top-2 h-1 rounded-full bg-[var(--primary-soft)]/70 group-hover:bg-[var(--primary)]/30 transition-colors" />
      <div className="flex justify-between items-start mb-2">
        <h4 
          className="font-medium text-gray-900 text-sm flex-1 pr-2 cursor-pointer hover:text-blue-600"
          onDoubleClick={(e) => {
            e.stopPropagation()
            if (onView) {
              onView(task)
            }
          }}
        >
          {task.title}
        </h4>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(task.id)
          }}
          className="text-red-500 hover:text-red-700 text-xs"
        >
          ×
        </button>
      </div>
      
      {task.description && (
        <p className="text-xs text-gray-600 mb-2 line-clamp-2">{task.description}</p>
      )}

      {task.contact && (
        <div className="text-xs text-gray-600 mb-2">
          <a
            href={`/contacts/${task.contact.id}`}
            className="text-blue-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            👤 {task.contact.name}
          </a>
        </div>
      )}

      {task.dueDate && (
        <div className="text-xs text-gray-500 mb-2">
          📅 {new Date(task.dueDate).toLocaleDateString('ru-RU')}
        </div>
      )}

      <div className="flex items-center justify-between">
        <select
          value={task.status}
          onChange={(e) => {
            e.stopPropagation()
            onStatusChange(task.id, e.target.value)
          }}
          onClick={(e) => e.stopPropagation()}
          className={`text-xs font-medium px-2 py-1 rounded border-0 ${getStatusColor(task.status)}`}
        >
          <option value="pending">Ожидает</option>
          <option value="in_progress">В работе</option>
          <option value="completed">Завершена</option>
        </select>
        
        {task.user && (
          <div className="text-xs text-gray-400">
            {task.user.name}
          </div>
        )}
      </div>
    </div>
  )
}
