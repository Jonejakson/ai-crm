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
    <div className="space-y-6">
      {/* Заголовок и навигация */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <a href="/contacts" className="text-blue-600 hover:text-blue-800">
            ← Назад к контактам
          </a>
          <h1 className="text-2xl font-bold text-gray-900">{contact.name}</h1>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setIsTaskModalOpen(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            + Добавить задачу
          </button>
        </div>
      </div>


      {/* Основная информация */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Контактная информация</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="text-gray-900">{contact.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Телефон</label>
                <p className="text-gray-900">{contact.phone || 'Не указан'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Компания</label>
                <p className="text-gray-900">{contact.company || 'Не указана'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Дата добавления</label>
                <p className="text-gray-900">
                  {new Date(contact.createdAt).toLocaleDateString('ru-RU')}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Статистика</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Всего задач:</span>
                <span className="font-semibold">{tasks.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Активные задачи:</span>
                <span className="font-semibold text-orange-600">
                  {tasks.filter(t => t.status === 'pending').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Завершенные задачи:</span>
                <span className="font-semibold text-green-600">
                  {tasks.filter(t => t.status === 'completed').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Сообщений в диалоге:</span>
                <span className="font-semibold">{dialogs.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Сделок:</span>
                <span className="font-semibold">{deals.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Сумма сделок:</span>
                <span className="font-semibold text-green-600">
                  {deals.reduce((sum, d) => sum + d.amount, 0).toLocaleString('ru-RU')} ₽
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Табы */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b border-gray-200">
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
                <p className="text-gray-500">Нет сделок для этого контакта</p>
              ) : (
                deals.map((deal) => (
                  <div key={deal.id} className="border border-gray-200 rounded-lg p-4">
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
                        className="text-blue-600 hover:text-blue-800 text-sm"
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
                <p className="text-gray-500">Нет задач для этого контакта</p>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="border border-gray-200 rounded-lg p-4">
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
                  <p className="text-gray-500">Нет сообщений</p>
                ) : (
                  dialogs.map((dialog) => (
                    <div
                      key={dialog.id}
                      className={`p-3 rounded-lg ${
                        dialog.sender === 'user'
                          ? 'bg-blue-100 ml-8'
                          : 'bg-gray-100 mr-8'
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
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                >
                  Отправить
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}