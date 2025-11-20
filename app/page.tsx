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
    <div className="space-y-7">
      <div className="glass-panel px-5 py-5 rounded-3xl">
        <UserFilter 
          selectedUserId={selectedUserId} 
          onUserChange={setSelectedUserId} 
        />
      </div>
      
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { 
            label: 'Клиенты', 
            value: contacts.length, 
            icon: '👥', 
            note: `+${newContactsCount} за 7 дней`, 
            accent: 'bg-blue-50 text-blue-600' 
          },
          { 
            label: 'Активные задачи', 
            value: pendingTasks, 
            icon: '✅', 
            note: overdueTasks ? `${overdueTasks} просрочено` : 'Без просрочки', 
            accent: 'bg-amber-50 text-amber-600' 
          },
          { 
            label: 'Активные сделки', 
            value: activeDeals, 
            icon: '💼', 
            note: `${openDealsAmount.toLocaleString('ru-RU')} ₽ в работе`, 
            accent: 'bg-purple-50 text-purple-600' 
          },
          { 
            label: 'Выручка', 
            value: `${totalDealsAmount.toLocaleString('ru-RU')} ₽`, 
            icon: '💵', 
            note: `${wonAmount.toLocaleString('ru-RU')} ₽ выиграно`, 
            accent: 'bg-emerald-50 text-emerald-600' 
          },
        ].map((card) => (
          <div key={card.label} className="stat-card flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)] font-semibold mb-1">{card.label}</p>
              <p className="stat-card-value">{card.value}</p>
              <p className="text-sm text-[var(--muted)]">{card.note}</p>
            </div>
            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-xl ${card.accent}`}>
              {card.icon}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="glass-panel rounded-3xl p-6 space-y-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Сделки</p>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Срез по воронке</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: 'Всего сделок', value: deals.length },
              { label: 'Выиграно', value: wonDeals.length },
              { label: 'Сумма выигрышей', value: `${wonAmount.toLocaleString('ru-RU')} ₽` },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-[var(--border)] bg-[var(--panel-muted)] p-4">
                <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Клиенты</p>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Последние контакты</h2>
            </div>
            <span className="text-xs text-[var(--muted)]">{recentContacts.length} записей</span>
          </div>
          <div>
            {recentContacts.length === 0 ? (
              <div className="empty-state py-10">
                <div className="empty-state-icon">👥</div>
                <h3 className="empty-state-title">Нет контактов</h3>
                <p className="empty-state-description">
                  Пока нет клиентов — импортируйте контакты или добавьте вручную.
                </p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Имя</th>
                    <th>Компания</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {recentContacts.map((contact) => (
                    <tr key={contact.id}>
                      <td>
                        <div className="flex flex-col">
                          <span className="font-medium text-[var(--foreground)]">{contact.name}</span>
                          <span className="text-xs text-[var(--muted)]">{contact.email}</span>
                        </div>
                      </td>
                      <td className="text-sm text-[var(--muted)]">{contact.company || '—'}</td>
                      <td className="text-sm text-[var(--muted)]">
                        {new Date(contact.createdAt).toLocaleDateString('ru-RU')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}