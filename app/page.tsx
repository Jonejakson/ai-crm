// app/page.tsx
'use client'

import { useState, useEffect } from 'react'
import UserFilter from '@/components/UserFilter'

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
  status: string
  dueDate: string | null
}

interface Deal {
  id: number
  title: string
  amount: number
  currency: string
  stage: string
}

export default function Dashboard() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)

  useEffect(() => {
    fetchData()
    // Проверяем просроченные задачи и предстоящие события при загрузке дашборда
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
      const contactsUrl = selectedUserId 
        ? `/api/contacts?userId=${selectedUserId}` 
        : '/api/contacts'
      const tasksUrl = selectedUserId 
        ? `/api/tasks?userId=${selectedUserId}` 
        : '/api/tasks'
      const dealsUrl = selectedUserId 
        ? `/api/deals?userId=${selectedUserId}` 
        : '/api/deals'
      
      const [contactsRes, tasksRes, dealsRes] = await Promise.all([
        fetch(contactsUrl),
        fetch(tasksUrl),
        fetch(dealsUrl)
      ])
      
      // Проверяем статус ответов
      if (!contactsRes.ok) {
        console.error('Error fetching contacts:', contactsRes.statusText)
        setContacts([])
      } else {
        const contactsData = await contactsRes.json()
        setContacts(Array.isArray(contactsData) ? contactsData : [])
      }
      
      if (!tasksRes.ok) {
        console.error('Error fetching tasks:', tasksRes.statusText)
        setTasks([])
      } else {
        const tasksData = await tasksRes.json()
        setTasks(Array.isArray(tasksData) ? tasksData : [])
      }

      if (!dealsRes.ok) {
        console.error('Error fetching deals:', dealsRes.statusText)
        setDeals([])
      } else {
        const dealsData = await dealsRes.json()
        setDeals(Array.isArray(dealsData) ? dealsData : [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      setContacts([])
      setTasks([])
      setDeals([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Загрузка...</div>
      </div>
    )
  }

  const pendingTasks = tasks.filter(task => task.status === 'pending').length
  const recentContacts = contacts.slice(0, 5)
  const activeDeals = deals.filter(deal => !deal.stage.startsWith('closed_')).length
  const totalDealsAmount = deals.reduce((sum, deal) => sum + deal.amount, 0)
  const wonDeals = deals.filter(deal => deal.stage === 'closed_won')
  const wonAmount = wonDeals.reduce((sum, deal) => sum + deal.amount, 0)

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Фильтр по менеджеру (только для админа) */}
      <UserFilter 
        selectedUserId={selectedUserId} 
        onUserChange={setSelectedUserId} 
      />
      
      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 hover:border-blue-200 group">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Всего клиентов</h3>
              <p className="text-3xl font-bold text-blue-600 mt-2 group-hover:scale-105 transition-transform duration-200">
                {contacts.length}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 hover:border-orange-200 group">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Активные задачи</h3>
              <p className="text-3xl font-bold text-orange-600 mt-2 group-hover:scale-105 transition-transform duration-200">
                {pendingTasks}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors">
              <span className="text-2xl">✅</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 hover:border-purple-200 group">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Активные сделки</h3>
              <p className="text-3xl font-bold text-purple-600 mt-2 group-hover:scale-105 transition-transform duration-200">
                {activeDeals}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
              <span className="text-2xl">💰</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 hover:border-green-200 group">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Сумма сделок</h3>
              <p className="text-3xl font-bold text-green-600 mt-2 group-hover:scale-105 transition-transform duration-200">
                {totalDealsAmount.toLocaleString('ru-RU')} ₽
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
              <span className="text-2xl">💵</span>
            </div>
          </div>
        </div>
      </div>

      {/* Статистика по сделкам */}
      {deals.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">Статистика по сделкам</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Всего сделок</p>
              <p className="text-2xl font-bold text-gray-900">{deals.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Выиграно</p>
              <p className="text-2xl font-bold text-green-600">{wonDeals.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Сумма выигрышей</p>
              <p className="text-2xl font-bold text-green-600">
                {wonAmount.toLocaleString('ru-RU')} ₽
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Последние клиенты */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Последние клиенты</h2>
        </div>
        <div className="p-6">
          {recentContacts.map((contact) => (
            <div key={contact.id} className="flex items-center justify-between py-3 border-b last:border-b-0">
              <div>
                <h4 className="font-medium text-gray-900">{contact.name}</h4>
                <p className="text-sm text-gray-500">{contact.email}</p>
              </div>
              <span className="text-sm text-gray-500">
                {new Date(contact.createdAt).toLocaleDateString('ru-RU')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}