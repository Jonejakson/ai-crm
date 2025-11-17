'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

interface Contact {
  id: number
  name: string
  email: string
  phone: string | null
  company: string | null
  createdAt: string
}

interface Task {
  id: number
  title: string
  description: string | null
  status: string
  dueDate: string | null
  createdAt: string
}

interface Dialog {
  id: number
  message: string
  sender: string
  createdAt: string
}

interface Deal {
  id: number
  title: string
  amount: number
  currency: string
  stage: string
  probability: number
  expectedCloseDate: string | null
  createdAt: string
}

export default function ContactDetailPage() {
  const params = useParams()
  const contactId = params.id

  const [contact, setContact] = useState<Contact | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [dialogs, setDialogs] = useState<Dialog[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('info')
  const [newMessage, setNewMessage] = useState('')
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    dueDate: ''
  })

  useEffect(() => {
    if (contactId) {
      fetchContactData()
    }
  }, [contactId])

  const fetchContactData = async () => {
    try {
      const [contactRes, tasksRes, dialogsRes, dealsRes] = await Promise.all([
        fetch(`/api/contacts`).then(res => res.json()),
        fetch(`/api/tasks`).then(res => res.json()),
        fetch(`/api/dialogs?contactId=${contactId}`).then(res => res.json()),
        fetch(`/api/deals`).then(res => res.json())
      ])

      // Находим конкретный контакт
      const foundContact = contactRes.find((c: Contact) => c.id === Number(contactId))
      setContact(foundContact)
      
      // Фильтруем задачи этого контакта
      const contactTasks = tasksRes.filter((task: Task & { contactId: number }) => 
        task.contactId === Number(contactId)
      )
      setTasks(contactTasks)

      // Фильтруем сделки этого контакта
      const contactDeals = dealsRes.filter((deal: Deal & { contactId: number }) => 
        deal.contactId === Number(contactId)
      )
      setDeals(contactDeals)

      setDialogs(Array.isArray(dialogsRes) ? dialogsRes : [])
    } catch (error) {
      console.error('Error fetching contact data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    try {
      const response = await fetch('/api/dialogs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: newMessage,
          contactId: Number(contactId),
          sender: 'user'
        }),
      })

      if (response.ok) {
        setNewMessage('')
        fetchContactData() // Обновляем диалоги
      }
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskFormData.title.trim()) return

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: taskFormData.title,
          contactId: Number(contactId),
          dueDate: taskFormData.dueDate || null,
          status: 'pending'
        }),
      })

      if (response.ok) {
        setIsTaskModalOpen(false)
        setTaskFormData({ title: '', dueDate: '' })
        fetchContactData() // Обновляем задачи
      }
    } catch (error) {
      console.error('Error creating task:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Загрузка...</div>
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-red-600">Контакт не найден</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <a href="/contacts" className="text-[var(--primary)] hover:underline">
            ← Назад к контактам
          </a>
          <h1 className="text-3xl font-semibold text-slate-900">{contact.name}</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsTaskModalOpen(true)}
            className="btn-primary"
          >
            + Добавить задачу
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="glass-panel rounded-3xl p-6 xl:col-span-2">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Профиль</p>
          <h2 className="text-2xl font-semibold text-slate-900 mt-1 mb-6">Контактная информация</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {[
              { label: 'Email', value: contact.email },
              { label: 'Телефон', value: contact.phone || 'Не указан' },
              { label: 'Компания', value: contact.company || 'Не указана' },
              { label: 'Дата добавления', value: new Date(contact.createdAt).toLocaleDateString('ru-RU') },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{item.label}</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6 space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Статистика</p>
            <h2 className="text-xl font-semibold text-slate-900 mt-1">Сводка по активности</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Всего задач', value: tasks.length },
              { label: 'Активные задачи', value: tasks.filter(t => t.status === 'pending').length, accent: 'text-orange-500' },
              { label: 'Завершенные задачи', value: tasks.filter(t => t.status === 'completed').length, accent: 'text-emerald-500' },
              { label: 'Сообщений', value: dialogs.length },
              { label: 'Сделок', value: deals.length },
              { label: 'Сумма сделок', value: `${deals.reduce((sum, d) => sum + d.amount, 0).toLocaleString('ru-RU')} ₽`, accent: 'text-emerald-600' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm">
                <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">{stat.label}</p>
                <p className={`mt-2 text-lg font-semibold ${stat.accent || 'text-slate-900'}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Сделки</p>
              <div className="mt-3 space-y-3">
                {deals.length === 0 ? (
                  <p className="text-sm text-slate-500">Нет сделок</p>
                ) : (
                  deals.map((deal) => (
                    <div key={deal.id} className="rounded-2xl border border-white/60 bg-white/90 p-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{deal.title}</p>
                          <p className="text-xs text-slate-500">
                            {deal.amount.toLocaleString('ru-RU')} {deal.currency} • {deal.stage}
                          </p>
                        </div>
                        <span className="text-xs text-slate-400">
                          {deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString('ru-RU') : ''}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.35ем] text-slate-400">Задачи</p>
              <div className="mt-3 space-y-3">
                {tasks.length === 0 ? (
                  <p className="text-sm text-slate-500">Нет задач</p>
                ) : (
                  tasks.map((task) => (
                    <div key={task.id} className="rounded-2xl border border-white/60 bg-white/90 p-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                          <p className="text-xs text-slate-500">
                            Статус: {task.status}{task.dueDate ? ` • до ${new Date(task.dueDate).toLocaleDateString('ru-RU')}` : ''}
                          </p>
                        </div>
                        <span className="text-xs text-slate-400">
                          {new Date(task.createdAt).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Табы */}
      <div className="glass-panel rounded-3xl">
        <div className="border-b border-white/40">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'info', name: 'Информация' },
              { id: 'deals', name: `Сделки (${deals.length})` },
              { id: 'tasks', name: `Задачи (${tasks.length})` },
              { id: 'dialogs', name: `Диалог (${dialogs.length})` }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Вкладка Сделки */}
          {activeTab === 'deals' && (
            <div className="space-y-4">
              {deals.length === 0 ? (
                <p className="text-slate-500">Нет сделок для этого контакта</p>
              ) : (
                deals.map((deal) => (
                  <div key={deal.id} className="rounded-2xl border border-white/60 bg-white/90 p-4 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">{deal.title}</h4>
                        <div className="flex space-x-4 mt-2 text-sm text-gray-500">
                          <span>Сумма: {deal.amount.toLocaleString('ru-RU')} {deal.currency}</span>
                          <span>Этап: {deal.stage}</span>
                          <span>Вероятность: {deal.probability}%</span>
                          {deal.expectedCloseDate && (
                            <span>
                              До: {new Date(deal.expectedCloseDate).toLocaleDateString('ru-RU')}
                            </span>
                          )}
                        </div>
                      </div>
                      <a
                        href="/deals"
                    className="text-[var(--primary)] hover:underline text-sm"
                      >
                        Перейти →
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Вкладка Задачи */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              {tasks.length === 0 ? (
                <p className="text-slate-500">Нет задач для этого контакта</p>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="rounded-2xl border border-white/60 bg-white/90 p-4 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">{task.title}</h4>
                        {task.description && (
                          <p className="text-gray-600 mt-1">{task.description}</p>
                        )}
                        <div className="flex space-x-4 mt-2 text-sm text-gray-500">
                          <span>Статус: {task.status}</span>
                          {task.dueDate && (
                            <span>
                              Срок: {new Date(task.dueDate).toLocaleDateString('ru-RU')}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(task.createdAt).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Вкладка Диалог */}
          {activeTab === 'dialogs' && (
            <div className="space-y-4">
              {/* История сообщений */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {dialogs.length === 0 ? (
                  <p className="text-slate-500">Нет сообщений</p>
                ) : (
                  dialogs.map((dialog) => (
                    <div
                      key={dialog.id}
                      className={`p-3 rounded-lg ${
                        dialog.sender === 'user'
                          ? 'bg-[var(--primary-soft)]/70 ml-8'
                          : 'bg-white/80 mr-8'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <p className="text-gray-900">{dialog.message}</p>
                        <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                          {new Date(dialog.createdAt).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {dialog.sender === 'user' ? 'Вы' : 'Клиент'}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Форма отправки сообщения */}
              <form onSubmit={handleSendMessage} className="flex space-x-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Введите сообщение..."
                  className="flex-1 rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
                />
                <button
                  type="submit"
                  className="btn-primary text-sm"
                >
                  Отправить
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно создания задачи */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Новая задача</h3>
              <button
                onClick={() => {
                  setIsTaskModalOpen(false)
                  setTaskFormData({ title: '', dueDate: '' })
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название задачи *
                </label>
                <input
                  type="text"
                  value={taskFormData.title}
                  onChange={(e) => setTaskFormData({...taskFormData, title: e.target.value})}
                  required
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
                  placeholder="Введите название задачи"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Когда должна быть исполнена
                </label>
                <input
                  type="date"
                  value={taskFormData.dueDate}
                  onChange={(e) => setTaskFormData({...taskFormData, dueDate: e.target.value})}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsTaskModalOpen(false)
                    setTaskFormData({ title: '', dueDate: '' })
                  }}
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