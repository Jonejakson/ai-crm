'use client'

import { useState, useEffect } from 'react'
import UserFilter from '@/components/UserFilter'
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
      }
    } catch (error) {
      console.error('Error creating task:', error)
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

      if (!response.ok) {
        await fetchData()
        throw new Error('Failed to update task')
      }
      
      await fetchData()
    } catch (error) {
      console.error('Error updating task:', error)
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
      }
    } catch (error) {
      console.error('Error deleting task:', error)
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
      }
    } catch (error) {
      console.error('Error updating task:', error)
    }
  }

  // Распределяем задачи по категориям
  const tasksByCategory = TASK_CATEGORIES.reduce((acc, category) => {
    acc[category.id] = tasks.filter(task => getTaskCategory(task.dueDate) === category.id)
    return acc
  }, {} as Record<string, Task[]>)

  if (loading) {
    return <div className="flex justify-center p-8">Загрузка...</div>
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
      
      <div className="glass-panel px-6 py-5 rounded-3xl">
        <UserFilter 
          selectedUserId={selectedUserId} 
          onUserChange={setSelectedUserId} 
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/40 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Новая задача</p>
                <h3 className="text-xl font-semibold text-slate-900">Создать карточку</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Название задачи *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  required
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Описание
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={4}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    Срок выполнения
                  </label>
                  <input
                    type="date"
                    name="dueDate"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                    className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    Связать с клиентом
                  </label>
                  <select
                    name="contactId"
                    value={formData.contactId}
                    onChange={(e) => setFormData({...formData, contactId: e.target.value})}
                    className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
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

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn-primary text-sm"
                >
                  Создать задачу
                </button>
              </div>
            </form>
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
  onStatusChange
}: { 
  category: { id: string; name: string; color: string }
  tasks: Task[]
  onDelete: (id: number) => void
  onStatusChange: (id: number, status: string) => void
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
          />
        ))}
      </div>
    </div>
  )
}

// Компонент карточки задачи с drag & drop
function TaskCard({ task, onDelete, onStatusChange }: { task: Task; onDelete: (id: number) => void; onStatusChange: (id: number, status: string) => void }) {
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
        <h4 className="font-medium text-gray-900 text-sm flex-1 pr-2">{task.title}</h4>
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
