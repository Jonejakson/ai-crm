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
  const overdueTasks = tasks.filter(task => {
    if (task.status !== 'pending' || !task.dueDate) return false
    return new Date(task.dueDate) < new Date()
  }).length
  const recentContacts = contacts.slice(0, 5)
  const activeDeals = deals.filter(deal => !deal.stage.startsWith('closed_')).length
  const totalDealsAmount = deals.reduce((sum, deal) => sum + deal.amount, 0)
  const wonDeals = deals.filter(deal => deal.stage === 'closed_won')
  const wonAmount = wonDeals.reduce((sum, deal) => sum + deal.amount, 0)
  const openDealsAmount = deals
    .filter(deal => !deal.stage.startsWith('closed_'))
    .reduce((sum, deal) => sum + deal.amount, 0)
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const newContactsCount = contacts.filter(contact => new Date(contact.createdAt) >= weekAgo).length

  return (
    <div className="space-y-8">
      <div className="glass-panel px-6 py-5 rounded-3xl">
        <UserFilter 
          selectedUserId={selectedUserId} 
          onUserChange={setSelectedUserId} 
        />
      </div>
      
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[
          { 
            label: 'Клиенты', 
            value: contacts.length, 
            icon: '👥', 
            note: `+${newContactsCount} за 7 дней`, 
            accent: 'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600',
            gradient: 'from-blue-500 to-blue-600'
          },
          { 
            label: 'Активные задачи', 
            value: pendingTasks, 
            icon: '✅', 
            note: overdueTasks ? `${overdueTasks} просрочено` : 'Без просрочки', 
            accent: 'bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600',
            gradient: 'from-amber-500 to-amber-600'
          },
          { 
            label: 'Активные сделки', 
            value: activeDeals, 
            icon: '💼', 
            note: `${openDealsAmount.toLocaleString('ru-RU')} ₽ в работе`, 
            accent: 'bg-gradient-to-br from-purple-50 to-purple-100 text-purple-600',
            gradient: 'from-purple-500 to-purple-600'
          },
          { 
            label: 'Выручка', 
            value: `${totalDealsAmount.toLocaleString('ru-RU')} ₽`, 
            icon: '💵', 
            note: `${wonAmount.toLocaleString('ru-RU')} ₽ выиграно`, 
            accent: 'bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600',
            gradient: 'from-emerald-500 to-emerald-600'
          },
        ].map((card) => (
          <div key={card.label} className="stat-card flex items-center justify-between gap-4 group">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)] font-bold mb-2">{card.label}</p>
              <p className="stat-card-value mb-1 group-hover:scale-105 transition-transform duration-300">{card.value}</p>
              <p className="text-sm text-[var(--muted)] font-medium">{card.note}</p>
            </div>
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-2xl shadow-md group-hover:scale-110 transition-transform duration-300 ${card.accent}`}>
              {card.icon}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="glass-panel rounded-3xl p-6 space-y-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)] font-bold mb-1">Сделки</p>
              <h2 className="text-2xl font-bold text-[var(--foreground)] bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] bg-clip-text text-transparent">Срез по воронке</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: 'Всего сделок', value: deals.length, color: 'from-blue-500 to-blue-600' },
              { label: 'Выиграно', value: wonDeals.length, color: 'from-emerald-500 to-emerald-600' },
              { label: 'Сумма выигрышей', value: `${wonAmount.toLocaleString('ru-RU')} ₽`, color: 'from-purple-500 to-purple-600' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--panel-muted)] to-[var(--surface)] p-5 hover:shadow-md transition-all duration-300 group">
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)] font-bold mb-3">{item.label}</p>
                <p className={`text-3xl font-bold bg-gradient-to-r ${item.color} bg-clip-text text-transparent group-hover:scale-105 transition-transform duration-300`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5 bg-gradient-to-r from-[var(--background-soft)] to-transparent">
            <div>
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)] font-bold mb-1">Клиенты</p>
              <h2 className="text-xl font-bold text-[var(--foreground)]">Последние контакты</h2>
            </div>
            <span className="text-xs font-semibold text-[var(--muted)] bg-[var(--background-soft)] px-3 py-1 rounded-full">{recentContacts.length} записей</span>
          </div>
          <div>
            {recentContacts.length === 0 ? (
              <div className="empty-state py-12">
                <div className="empty-state-icon">👥</div>
                <h3 className="empty-state-title">Нет контактов</h3>
                <p className="empty-state-description">
                  Пока нет клиентов — импортируйте контакты или добавьте вручную.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-soft)]">
                {recentContacts.map((contact, index) => (
                  <div key={contact.id} className="px-6 py-4 hover:bg-[var(--background-soft)] transition-colors duration-200 group">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--primary-soft)] to-[var(--primary)] flex items-center justify-center text-[var(--primary)] font-bold text-sm shadow-sm group-hover:scale-110 transition-transform duration-300">
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[var(--foreground)] truncate">{contact.name}</p>
                            <p className="text-xs text-[var(--muted)] truncate">{contact.email}</p>
                          </div>
                        </div>
                        <p className="text-sm text-[var(--muted)] ml-[52px]">{contact.company || '—'}</p>
                      </div>
                      <span className="text-xs text-[var(--muted)] font-medium whitespace-nowrap">
                        {new Date(contact.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}