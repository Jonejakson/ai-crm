'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useKeyboardShortcuts } from '@/lib/keyboard-shortcuts'
import { useSubscription } from '@/lib/subscription-context'
import UserFilter from '@/components/UserFilter'
import FilesManager from '@/components/FilesManager'
import Comments from '@/components/Comments'
import CustomFieldsEditor from '@/components/CustomFieldsEditor'
import Skeleton, { SkeletonKanban } from '@/components/Skeleton'
import { CalendarIcon } from '@/components/Icons'
import ExportButton from '@/components/ExportButton'
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
  updatedAt: string
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

interface DateRange {
  start?: string
  end?: string
}

interface TaskFilters {
  status?: string[]
  dateRange?: DateRange
  dueDateRange?: DateRange
}

const formatDueDateTime = (value?: string | null) => {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
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
  
  const now = new Date()
  const due = new Date(dueDate)

  // Просрочено по времени (важно для задач "сегодня", но с прошедшим временем)
  if (!Number.isNaN(due.getTime()) && due.getTime() < now.getTime()) {
    return 'overdue'
  }

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const taskDate = new Date(due)
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
  const { subscriptionActive } = useSubscription()
  const [tasks, setTasks] = useState<Task[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [viewingTask, setViewingTask] = useState<Task | null>(null)
  // Убрали вкладки - все в одной прокручиваемой странице
  const [filters, setFilters] = useState<TaskFilters>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [quickDateFilter, setQuickDateFilter] = useState<string>('month')
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    dueTime: '',
    contactId: '',
    status: 'pending'
  })
  const quickDateOptions = [
    { value: 'today', label: 'Сегодня' },
    { value: 'week', label: 'Эта неделя' },
    { value: 'month', label: 'Этот месяц' },
    { value: 'quarter', label: 'Этот квартал' },
    { value: 'year', label: 'Этот год' },
  ]
  const statusOptions = [
    { value: 'pending', label: 'В ожидании' },
    { value: 'in_progress', label: 'В работе' },
    { value: 'completed', label: 'Завершено' },
    { value: 'cancelled', label: 'Отменено' },
  ]

  const formatDateInput = (date: Date) => date.toISOString().split('T')[0]

  const getQuickDateRange = (value: string) => {
    const now = new Date()
    const start = new Date(now)
    const end = new Date(now)

    switch (value) {
      case 'today':
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break
      case 'week':
        const day = start.getDay()
        start.setDate(start.getDate() - day)
        start.setHours(0, 0, 0, 0)
        end.setDate(start.getDate() + 6)
        end.setHours(23, 59, 59, 999)
        break
      case 'month':
        start.setDate(1)
        start.setHours(0, 0, 0, 0)
        end.setMonth(end.getMonth() + 1, 0)
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

    return { start, end }
  }

  useEffect(() => {
    if (!quickDateFilter) return
    const { start, end } = getQuickDateRange(quickDateFilter)
    setFilters((prev) => ({
      ...prev,
      dateRange: {
        start: formatDateInput(start),
        end: formatDateInput(end),
      },
    }))
  }, [quickDateFilter])

  const handleQuickDateClick = (value: string) => {
    if (value === quickDateFilter) {
      setQuickDateFilter('')
      setFilters((prev) => {
        if (!prev.dateRange) return prev
        const { dateRange, ...rest } = prev
        return rest
      })
    } else {
      setQuickDateFilter(value)
    }
  }

  const handleDateInputChange = (field: 'start' | 'end', value: string) => {
    setQuickDateFilter('')
    setFilters((prev) => {
      const nextRange = { ...(prev.dateRange || {}), [field]: value || undefined }
      if (!nextRange.start && !nextRange.end) {
        const { dateRange, ...rest } = prev
        return rest
      }
      return { ...prev, dateRange: nextRange }
    })
  }

  const handleStatusToggle = (status: string) => {
    setFilters((prev) => {
      const currentStatuses: string[] = prev.status || []
      const nextStatuses = currentStatuses.includes(status)
        ? currentStatuses.filter(s => s !== status)
        : [...currentStatuses, status]

      if (nextStatuses.length === 0) {
        const { status: _removed, ...rest } = prev
        return rest
      }

      return { ...prev, status: nextStatuses }
    })
  }

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
  }, [selectedUserId])

  // Клавиатурные сокращения для страницы задач
  useKeyboardShortcuts([
    {
      key: 'n',
      ctrl: true,
      action: () => { if (subscriptionActive !== false) setIsModalOpen(true) },
      description: 'Создать новую задачу',
    },
  ])

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
        fetch(tasksUrl).then(async (res) => {
          if (!res.ok) return []
          const data = await res.json().catch(() => [])
          return Array.isArray(data) ? data : []
        }),
        fetch(contactsUrl).then(async (res) => {
          if (!res.ok) return []
          const data = await res.json().catch(() => [])
          return Array.isArray(data) ? data : []
        }),
      ])

      setTasks(tasksRes as any)
      setContacts(contactsRes as any)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Не удалось загрузить задачи. Попробуйте обновить страницу.')
    } finally {
      setLoading(false)
    }
  }

  const buildDueDateValue = (date: string, time: string) => {
    if (!date) return null
    const t = time && time.trim() ? time.trim() : '00:00'
    const d = new Date(`${date}T${t}:00`)
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { dueTime, ...restFormData } = formData
      const dueDateValue = buildDueDateValue(formData.dueDate, dueTime)
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...restFormData,
          contactId: formData.contactId ? Number(formData.contactId) : null,
          dueDate: dueDateValue
        }),
      })

      if (response.ok) {
        await fetchData()
        setIsModalOpen(false)
        setFormData({
          title: '',
          description: '',
          dueDate: '',
          dueTime: '',
          contactId: '',
          status: 'pending'
        })
        toast.success('Задача успешно создана')
      } else {
        const error = await response.json()
        toast.error(error.message || error.error || 'Ошибка при создании задачи')
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
    const newDueDate = newDate ? new Date(`${newDate.toISOString().split('T')[0]}T00:00:00`).toISOString() : null

    // Если дата не изменилась, ничего не делаем
    const currentDueDate = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : null
    const nextDueDate = newDueDate ? new Date(newDueDate).toISOString().split('T')[0] : null
    if (currentDueDate === nextDueDate) {
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
        toast.error(error.message || error.error || 'Ошибка при обновлении задачи')
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
        toast.error(error.message || error.error || 'Ошибка при удалении задачи')
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
        toast.error(error.message || error.error || 'Ошибка при обновлении задачи')
      }
    } catch (error) {
      console.error('Error updating task:', error)
      toast.error('Ошибка при обновлении задачи')
    }
  }

  // Применяем фильтры к задачам
  const filteredTasks = tasks.filter(task => {
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      const matchesSearch =
        task.title.toLowerCase().includes(term) ||
        (task.description?.toLowerCase().includes(term)) ||
        (task.contact?.name?.toLowerCase().includes(term)) ||
        (task.contact?.email?.toLowerCase().includes(term))
      if (!matchesSearch) return false
    }

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

  const archivedTasks = filteredTasks
    .filter(task => task.status === 'completed')
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
  const activeTasks = filteredTasks.filter(task => task.status !== 'completed')

  // Распределяем задачи по категориям
  const tasksByCategory = TASK_CATEGORIES.reduce((acc, category) => {
    acc[category.id] = activeTasks.filter(task => getTaskCategory(task.dueDate) === category.id)
    return acc
  }, {} as Record<string, Task[]>)

  const totalTasks = filteredTasks.length
  const activeTasksCount = activeTasks.length
  const completedTasks = archivedTasks.length
  const inProgressTasks = filteredTasks.filter(task => task.status === 'in_progress').length
  const overdueTasks = tasksByCategory.overdue?.length || 0
  const todayTasks = tasksByCategory.today?.length || 0
  const upcomingTasks = tasksByCategory.next_week?.length || 0
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Контроль задач</p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Лента задач</h1>
          <p className="text-sm text-[var(--muted)]">
            Следите за сроками, распределяйте ответственность и мгновенно реагируйте на просрочки.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ExportButton 
            entityType="tasks" 
            label="Экспорт CSV"
            className="text-sm"
          />
          {subscriptionActive !== false && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary text-sm"
          >
            + Новая задача
          </button>
          )}
        </div>
      </div>
      
      <div className="glass-panel rounded-3xl p-6 space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Быстрый поиск по названию, описанию или клиенту..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
            />
          </div>
          <div className="w-full min-w-[220px] lg:w-auto">
            <UserFilter 
              selectedUserId={selectedUserId} 
              onUserChange={setSelectedUserId} 
            />
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)] mb-2">Быстрые фильтры</p>
              <div className="flex flex-wrap gap-2">
                {quickDateOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleQuickDateClick(option.value)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      quickDateFilter === option.value
                        ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-md'
                        : 'bg-white text-[var(--muted)] border border-[var(--border)] hover:border-[var(--primary)]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)] mb-2">Диапазон дат</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-[var(--muted)] mb-1 block">От</label>
                  <input
                    type="date"
                    value={filters.dateRange?.start || ''}
                    onChange={(e) => handleDateInputChange('start', e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)] mb-1 block">До</label>
                  <input
                    type="date"
                    value={filters.dateRange?.end || ''}
                    onChange={(e) => handleDateInputChange('end', e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Статусы</p>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((status) => (
                <button
                  key={status.value}
                  onClick={() => handleStatusToggle(status.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    filters.status?.includes(status.value)
                      ? 'bg-[var(--primary)] text-white shadow-md'
                      : 'bg-white text-[var(--muted)] border border-[var(--border)] hover:border-[var(--primary)]'
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Всего активных', value: activeTasksCount, note: `${completedTasks} завершено` },
          { label: 'Просрочено', value: overdueTasks, note: `${todayTasks} на сегодня` },
          { label: 'В работе', value: inProgressTasks, note: `${upcomingTasks} на ближайшую неделю` },
          { label: 'Выполнение', value: `${completionRate}%`, note: 'Доля закрытых задач' },
        ].map((card) => (
          <div key={card.label} className="stat-card">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)] mb-1">{card.label}</p>
            <p className="stat-card-value">{card.value}</p>
            <p className="text-sm text-[var(--muted)]">{card.note}</p>
          </div>
        ))}
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
          <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
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
                    {formatDueDateTime(activeTask.dueDate)}
                  </div>
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <div className="glass-panel rounded-3xl p-6 space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Архив</p>
            <h3 className="text-xl font-semibold text-[var(--foreground)]">Выполненные задачи</h3>
            <p className="text-sm text-[var(--muted)]">Последние завершённые задачи остаются в истории.</p>
          </div>
          <span className="text-sm text-[var(--muted)]">Всего: {archivedTasks.length}</span>
        </div>
        {archivedTasks.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">В архиве пока нет задач.</p>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {archivedTasks.slice(0, 15).map(task => (
              <div
                key={task.id}
                className="rounded-2xl border border-[var(--border)] bg-white/90 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer"
                onClick={() => setViewingTask(task)}
              >
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-[var(--muted)] mt-1 line-clamp-2">{task.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-4 h-4" />
                          {formatDueDateTime(task.dueDate)}
                        </span>
                      )}
                      {task.contact && (
                        <a
                          href={`/contacts/${task.contact.id}`}
                          className="text-[var(--primary)] hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          👤 {task.contact.name}
                        </a>
                      )}
                      {task.user && <span>🧑 {task.user.name}</span>}
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.3em] text-emerald-500">Завершена</span>
                </div>
              </div>
            ))}
          </div>
        )}
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

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                    Время
                  </label>
                  <input
                    type="time"
                    name="dueTime"
                    value={formData.dueTime}
                    onChange={(e) => setFormData({...formData, dueTime: e.target.value})}
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

      {/* Модальное окно просмотра деталей задачи - упрощенное, без вкладок */}
      {viewingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-xl font-semibold">{viewingTask.title}</h3>
              <button
                onClick={() => setViewingTask(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Все содержимое в одной прокручиваемой области */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Основная информация */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Основная информация</h4>
                {viewingTask.description && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Описание</label>
                    <p className="text-gray-900 whitespace-pre-wrap">{viewingTask.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Статус</label>
                    <p className="text-gray-900">
                      {viewingTask.status === 'completed' ? 'Завершена' : 
                       viewingTask.status === 'in_progress' ? 'В работе' : 'Ожидает'}
                    </p>
                  </div>
                  {viewingTask.dueDate && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Срок выполнения</label>
                      <p className="text-gray-900">
                        {formatDueDateTime(viewingTask.dueDate)}
                      </p>
                    </div>
                  )}
                  {viewingTask.contact && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Клиент</label>
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
                      <label className="block text-xs font-medium text-gray-500 mb-1">Ответственный</label>
                      <p className="text-gray-900">{viewingTask.user.name}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Комментарии */}
              <div className="border-t pt-6">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Комментарии</h4>
                <Comments
                  entityType="task"
                  entityId={viewingTask.id}
                />
              </div>

              {/* Дополнительные поля */}
              <div className="border-t pt-6">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Дополнительные поля</h4>
                <CustomFieldsEditor
                  entityType="task"
                  entityId={viewingTask.id}
                  onSave={() => {}}
                />
              </div>

              {/* Файлы */}
              <div className="border-t pt-6">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Файлы</h4>
                <FilesManager
                  entityType="task"
                  entityId={viewingTask.id}
                />
              </div>
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
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Категория</p>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{category.name}</h3>
        </div>
        <span className="text-sm font-semibold text-[var(--muted)]">{tasks.length}</span>
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
          <span className="flex items-center gap-1">
            <CalendarIcon className="w-4 h-4" />
            {formatDueDateTime(task.dueDate)}
          </span>
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
