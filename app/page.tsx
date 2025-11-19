// app/page.tsx
'use client'

import { useState, useEffect } from 'react'
import UserFilter from '@/components/UserFilter'
import Skeleton, { SkeletonKanban } from '@/components/Skeleton'

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
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card">
              <Skeleton variant="text" width="60%" height={12} className="mb-3" />
              <Skeleton variant="text" width="100%" height={32} className="mb-2" />
              <Skeleton variant="text" width="80%" height={12} />
            </div>
          ))}
        </div>
        <SkeletonKanban />
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
    <div className="space-y-8">
      <div className="glass-panel px-6 py-5 rounded-3xl">
        <UserFilter 
          selectedUserId={selectedUserId} 
          onUserChange={setSelectedUserId} 
        />
      </div>
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Всего клиентов', value: contacts.length, icon: '👥', gradient: 'from-blue-500 to-cyan-500', bg: 'bg-blue-50' },
          { label: 'Активные задачи', value: pendingTasks, icon: '✅', gradient: 'from-orange-500 to-amber-500', bg: 'bg-orange-50' },
          { label: 'Активные сделки', value: activeDeals, icon: '💰', gradient: 'from-purple-500 to-pink-500', bg: 'bg-purple-50' },
          { label: 'Сумма сделок', value: `${totalDealsAmount.toLocaleString('ru-RU')} ₽`, icon: '💵', gradient: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50' },
        ].map((card) => (
          <div key={card.label} className="stat-card group relative overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
            <div className="relative flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] font-semibold mb-2">{card.label}</p>
                <p className={`stat-card-value bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent`}>
                  {card.value}
                </p>
              </div>
              <div className={`rounded-2xl ${card.bg} p-4 text-3xl shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {deals.length > 0 && (
        <div className="glass-panel p-6 rounded-3xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Сделки</p>
              <h2 className="text-2xl font-semibold text-slate-900">Динамика по воронке</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { label: 'Всего сделок', value: deals.length },
              { label: 'Выиграно', value: wonDeals.length },
              { label: 'Сумма выигрышей', value: `${wonAmount.toLocaleString('ru-RU')} ₽` },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-panel rounded-3xl">
        <div className="flex items-center justify-between border-b border-white/40 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Клиенты</p>
            <h2 className="text-xl font-semibold text-slate-900">Последние контакты</h2>
          </div>
          <span className="text-sm text-slate-500">{recentContacts.length} записей</span>
        </div>
        <div className="divide-y divide-white/40">
          {recentContacts.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <h3 className="empty-state-title">Нет контактов</h3>
              <p className="empty-state-description">
                Пока нет клиентов — импортируйте контакты или добавьте вручную.
              </p>
            </div>
          )}
          {recentContacts.map((contact) => (
            <div key={contact.id} className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="text-sm font-medium text-slate-900">{contact.name}</p>
                <p className="text-xs text-slate-500">{contact.email}</p>
              </div>
              <span className="text-xs text-slate-400">
                {new Date(contact.createdAt).toLocaleDateString('ru-RU')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}