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
  { id: 'overdue', name: 'Просроченные', color: 'bg-red-100 border-red-300' },
  { id: 'today', name: 'Сегодня', color: 'bg-orange-100 border-orange-300' },
  { id: 'tomorrow', name: 'Завтра', color: 'bg-yellow-100 border-yellow-300' },
  { id: 'next_week', name: 'Следующая неделя', color: 'bg-blue-100 border-blue-300' },
  { id: 'next_month', name: 'Следующий месяц', color: 'bg-purple-100 border-purple-300' },
  { id: 'no_date', name: 'Без даты', color: 'bg-gray-100 border-gray-300' },
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
    <div className="space-y-6">
      {/* Заголовок и фильтры */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Задачи</h1>
      </div>
      
      {/* Фильтр по менеджеру (только для админа) */}
      <UserFilter 
        selectedUserId={selectedUserId} 
        onUserChange={setSelectedUserId} 
      />
      
      <div className="flex justify-end">
        <div className="flex space-x-2">
          <button 
            onClick={() => {
              window.location.href = '/api/export/tasks?format=excel'
            }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
          >
            <span>📥</span>
            <span>Экспорт CSV</span>
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            + Новая задача
          </button>
        </div>
      </div>

      {/* Канбан-доска */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Новая задача</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название задачи *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  required
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Описание
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Срок выполнения
                  </label>
                  <input
                    type="date"
                    name="dueDate"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Связать с клиентом
                  </label>
                  <select
                    name="contactId"
                    value={formData.contactId}
                    onChange={(e) => setFormData({...formData, contactId: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
      className={`flex-shrink-0 w-64 ${category.color} rounded-lg p-3 border-2 ${isOver ? 'ring-2 ring-blue-500' : ''}`}
    >
      <h3 className="font-semibold text-gray-900 mb-3">
        {category.name} ({tasks.length})
      </h3>
      <div className="space-y-2 min-h-[100px]">
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
      className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-medium text-gray-900 text-sm flex-1">{task.title}</h4>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(task.id)
          }}
          className="text-red-500 hover:text-red-700 text-xs ml-2"
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
