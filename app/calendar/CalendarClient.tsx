'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import UserFilter from '@/components/UserFilter'
import ExportButton from '@/components/ExportButton'
import { CalendarIcon, EditIcon, EmptyIcon } from '@/components/Icons'

interface Event {
  id: number
  title: string
  description: string | null
  startDate: string
  endDate: string | null
  location: string | null
  type: string
  contact: {
    id: number
    name: string
    email: string
    phone: string | null
  } | null
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

export default function CalendarClient() {
  const [events, setEvents] = useState<Event[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    location: '',
    type: 'meeting',
    contactId: ''
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState<'all' | 'meeting' | 'call' | 'task' | 'other'>('all')

  useEffect(() => {
    fetchData()
    // Проверяем предстоящие события при загрузке календаря
    checkNotifications()
  }, [currentDate, view, selectedUserId])

  const checkNotifications = async () => {
    try {
      await fetch('/api/notifications/check', { method: 'POST' })
    } catch (error) {
      console.error('Error checking notifications:', error)
    }
  }

  const fetchData = async () => {
    try {
      const startDate = new Date(currentDate)
      const endDate = new Date(currentDate)

      if (view === 'month') {
        startDate.setDate(1)
        endDate.setMonth(endDate.getMonth() + 1)
        endDate.setDate(0)
      } else if (view === 'week') {
        const day = startDate.getDay()
        startDate.setDate(startDate.getDate() - day)
        endDate.setDate(startDate.getDate() + 6)
      }

      const eventsUrl = selectedUserId 
        ? `/api/events?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&userId=${selectedUserId}`
        : `/api/events?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      const contactsUrl = selectedUserId 
        ? `/api/contacts?userId=${selectedUserId}` 
        : '/api/contacts'
      
      const [eventsRes, contactsRes] = await Promise.all([
        fetch(eventsUrl).then(res => res.ok ? res.json() : []),
        fetch(contactsUrl).then(res => res.ok ? res.json() : [])
      ])

      setEvents(Array.isArray(eventsRes) ? eventsRes : [])
      setContacts(Array.isArray(contactsRes) ? contactsRes : [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime || '09:00'}`)
      const endDateTime = formData.endDate && formData.endTime 
        ? new Date(`${formData.endDate}T${formData.endTime}`)
        : formData.endDate
          ? new Date(`${formData.endDate}T${formData.startTime || '10:00'}`)
          : null

      const url = selectedEvent ? '/api/events' : '/api/events'
      const method = selectedEvent ? 'PUT' : 'POST'
      const contactId = formData.contactId ? Number(formData.contactId) : null
      const body = selectedEvent
        ? {
            id: selectedEvent.id,
            title: formData.title,
            description: formData.description || null,
            startDate: startDateTime.toISOString(),
            endDate: endDateTime ? endDateTime.toISOString() : null,
            location: formData.location || null,
            type: formData.type,
            contactId: contactId,
          }
        : {
            title: formData.title,
            description: formData.description || null,
            startDate: startDateTime.toISOString(),
            endDate: endDateTime ? endDateTime.toISOString() : null,
            location: formData.location || null,
            type: formData.type,
            contactId: contactId,
          }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        await fetchData()
        setIsModalOpen(false)
        setSelectedEvent(null)
        setFormData({
          title: '',
          description: '',
          startDate: '',
          startTime: '',
          endDate: '',
          endTime: '',
          location: '',
          type: 'meeting',
          contactId: ''
        })
        toast.success(selectedEvent ? 'Событие успешно обновлено' : 'Событие успешно создано')
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Неизвестная ошибка' }))
        toast.error(errorData.error || 'Ошибка при сохранении события')
      }
    } catch (error) {
      console.error('Error saving event:', error)
      toast.error('Ошибка при сохранении события. Проверьте подключение к интернету.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (eventId: number) => {
    if (!confirm('Удалить событие?')) return

    try {
      const response = await fetch(`/api/events?id=${eventId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Error deleting event:', error)
    }
  }

  const openEditModal = (event: Event) => {
    setSelectedEvent(event)
    const startDate = new Date(event.startDate)
    const endDate = event.endDate ? new Date(event.endDate) : null
    
    setFormData({
      title: event.title,
      description: event.description || '',
      startDate: startDate.toISOString().split('T')[0],
      startTime: startDate.toTimeString().slice(0, 5),
      endDate: endDate ? endDate.toISOString().split('T')[0] : '',
      endTime: endDate ? endDate.toTimeString().slice(0, 5) : '',
      location: event.location || '',
      type: event.type,
      contactId: event.contact?.id.toString() || ''
    })
    setIsModalOpen(true)
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    
    // Пустые ячейки для дней предыдущего месяца
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // Дни текущего месяца
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }
    
    return days
  }

  const getEventsForDate = (date: Date | null, list: Event[] = filteredEvents) => {
    if (!date) return []
    const dateStr = date.toISOString().split('T')[0]
    return list.filter(event => {
      const eventDate = new Date(event.startDate).toISOString().split('T')[0]
      return eventDate === dateStr
    })
  }

  const getEventTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      meeting: 'bg-[var(--primary-soft)] border-[var(--primary)]/30 text-[var(--primary)]',
      call: 'bg-[var(--success-soft)] border-[var(--success)]/30 text-[var(--success)]',
      task: 'bg-[var(--warning-soft)] border-[var(--warning)]/30 text-[var(--warning)]',
      other: 'bg-[var(--background-soft)] border-[var(--border)] text-[var(--muted)]',
    }
    return colors[type] || colors.other
  }

  const filteredEvents = events.filter(event => {
    const term = searchTerm.trim().toLowerCase()
    const matchesSearch = term
      ? event.title.toLowerCase().includes(term) ||
        (event.description?.toLowerCase().includes(term)) ||
        (event.contact?.name?.toLowerCase().includes(term)) ||
        (event.contact?.email?.toLowerCase().includes(term))
      : true
    const matchesType = eventTypeFilter === 'all' || event.type === eventTypeFilter
    return matchesSearch && matchesType
  })

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const nextWeek = new Date(now)
  nextWeek.setDate(now.getDate() + 7)

  const totalEvents = filteredEvents.length
  const meetingsCount = filteredEvents.filter(event => event.type === 'meeting').length
  const callsCount = filteredEvents.filter(event => event.type === 'call').length
  const todayEvents = filteredEvents.filter(event => {
    const eventDate = new Date(event.startDate)
    eventDate.setHours(0, 0, 0, 0)
    return eventDate.getTime() === now.getTime()
  }).length
  const upcomingWeekEvents = filteredEvents.filter(event => {
    const eventDate = new Date(event.startDate)
    return eventDate >= now && eventDate <= nextWeek
  }).length
  const uniqueContacts = new Set(
    filteredEvents
      .map(event => event.contact?.id)
      .filter((id): id is number => typeof id === 'number')
  ).size
  const busyScore = totalEvents > 0 ? Math.min(100, Math.round((upcomingWeekEvents / totalEvents) * 100)) : 0

  const days = getDaysInMonth(currentDate)
  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-[var(--muted)]">Загрузка календаря...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Заголовок */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Календарь Pocket CRM</p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Синхронизируйте встречи, звонки и задачи по всей команде в одном окне.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ExportButton 
            entityType="events" 
            label="Экспорт CSV"
            className="text-sm"
          />
          <button
            onClick={() => {
              window.open('/api/integrations/calendar/ics', '_blank')
            }}
            className="btn-secondary text-sm"
          >
            <CalendarIcon className="w-4 h-4" /> iCal / Google
          </button>
          <button
            onClick={() => {
              setSelectedEvent(null)
              setFormData({
                title: '',
                description: '',
                startDate: new Date().toISOString().split('T')[0],
                startTime: '09:00',
                endDate: '',
                endTime: '',
                location: '',
                type: 'meeting',
                contactId: ''
              })
              setIsModalOpen(true)
            }}
            className="btn-primary text-sm"
          >
            + Новое событие
          </button>
        </div>
      </div>
      
      <div className="glass-panel rounded-3xl p-6 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Быстрый поиск по названию, клиенту или описанию..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
            />
          </div>
          <div className="min-w-[220px]">
            <UserFilter 
              selectedUserId={selectedUserId} 
              onUserChange={setSelectedUserId} 
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'Все' },
            { id: 'meeting', label: 'Встречи' },
            { id: 'call', label: 'Звонки' },
            { id: 'task', label: 'Задачи' },
            { id: 'other', label: 'Прочее' },
          ].map(option => (
            <button
              key={option.id}
              onClick={() => setEventTypeFilter(option.id as typeof eventTypeFilter)}
              className={`px-4 py-2 rounded-2xl text-sm font-medium transition-all ${
                eventTypeFilter === option.id
                  ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-lg'
                  : 'bg-white/80 text-[var(--muted)] border border-[var(--border)] hover:border-[var(--primary)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Всего событий', value: totalEvents, note: `${meetingsCount} встреч · ${callsCount} звонков` },
          { label: 'Сегодня', value: todayEvents, note: `${upcomingWeekEvents} в ближайшие 7 дней` },
          { label: 'С клиентами', value: uniqueContacts, note: 'Уникальные контакты' },
          { label: 'Загрузка недели', value: `${busyScore}%`, note: 'Заполненность слотов' },
        ].map(card => (
          <div key={card.label} className="stat-card">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)] mb-1">{card.label}</p>
            <p className="stat-card-value">{card.value}</p>
            <p className="text-sm text-[var(--muted)]">{card.note}</p>
          </div>
        ))}
      </div>

      {/* Навигация календаря */}
      <div className="glass-panel p-4 md:p-6 rounded-3xl">
        {/* Мобильная версия */}
        <div className="flex flex-col gap-3 md:hidden">
          {/* Месяц и год - первым */}
          <div className="text-center">
            <div className="text-lg font-semibold text-[var(--foreground)]">
              {monthNames[currentDate.getMonth()].slice(0, 3)} {currentDate.getFullYear()}
            </div>
          </div>
          {/* Кнопки навигации - в один ряд, каждая 45% */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => {
                const newDate = new Date(currentDate)
                newDate.setMonth(newDate.getMonth() - 1)
                setCurrentDate(newDate)
              }}
              className="btn-secondary p-2 flex-1 max-w-[45%] min-h-[40px] flex items-center justify-center"
              aria-label="Предыдущий месяц"
            >
              ←
            </button>
            <button
              onClick={() => {
                const newDate = new Date(currentDate)
                newDate.setMonth(newDate.getMonth() + 1)
                setCurrentDate(newDate)
              }}
              className="btn-secondary p-2 flex-1 max-w-[45%] min-h-[40px] flex items-center justify-center"
              aria-label="Следующий месяц"
            >
              →
            </button>
          </div>
          {/* Кнопки вида */}
          <div className="flex gap-2">
            <button
              onClick={() => setView('month')}
              className={`flex-1 px-4 py-2 rounded-xl font-medium transition-all ${
                view === 'month' 
                  ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-lg' 
                  : 'bg-white text-[var(--muted)] border border-[var(--border)] hover:border-[var(--primary)]'
              }`}
              title="Месячный вид календаря"
            >
              📆 Месяц
            </button>
            <button
              onClick={() => {
                toast.error('Недельный вид находится в разработке')
              }}
              className="flex-1 bg-white text-[var(--muted)] border border-[var(--border)] hover:border-[var(--primary)] px-4 py-2 rounded-xl font-medium transition-all opacity-50 cursor-not-allowed"
              title="Недельный вид в разработке"
              disabled
            >
              <CalendarIcon className="w-4 h-4" /> Неделя
            </button>
          </div>
        </div>
        
        {/* Десктопная версия */}
        <div className="hidden md:flex md:items-center md:justify-between md:gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newDate = new Date(currentDate)
                newDate.setMonth(newDate.getMonth() - 1)
                setCurrentDate(newDate)
              }}
              className="btn-secondary p-2 min-w-[40px] min-h-[40px] flex items-center justify-center"
              aria-label="Предыдущий месяц"
            >
              ←
            </button>
            <div className="text-lg font-semibold text-[var(--foreground)] px-3">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </div>
            <button
              onClick={() => {
                const newDate = new Date(currentDate)
                newDate.setMonth(newDate.getMonth() + 1)
                setCurrentDate(newDate)
              }}
              className="btn-secondary p-2 min-w-[40px] min-h-[40px] flex items-center justify-center"
              aria-label="Следующий месяц"
            >
              →
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setView('month')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                view === 'month' 
                  ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-lg' 
                  : 'bg-white text-[var(--muted)] border border-[var(--border)] hover:border-[var(--primary)]'
              }`}
              title="Месячный вид календаря"
            >
              📆 Месяц
            </button>
            <button
              onClick={() => {
                toast.error('Недельный вид находится в разработке')
              }}
              className="bg-white text-[var(--muted)] border border-[var(--border)] hover:border-[var(--primary)] px-4 py-2 rounded-xl font-medium transition-all opacity-50 cursor-not-allowed"
              title="Недельный вид в разработке"
              disabled
            >
              <CalendarIcon className="w-4 h-4" /> Неделя
            </button>
          </div>
        </div>
      </div>

      {/* Календарь */}
      {view === 'month' && (
        <div className="glass-panel rounded-3xl overflow-hidden">
          <div className="grid grid-cols-7 gap-px bg-[var(--border-soft)]">
            {dayNames.map(day => (
              <div key={day} className="bg-gradient-to-r from-[var(--background-soft)] to-white/80 p-2 md:p-3 text-center text-[10px] md:text-xs font-semibold uppercase tracking-[0.1em] md:tracking-[0.2em] text-[var(--muted)]">
                <span className="hidden md:inline">{day}</span>
                <span className="md:hidden">{day.slice(0, 2)}</span>
              </div>
            ))}
            {days.map((date, index) => {
              const dayEvents = getEventsForDate(date)
              const isToday = date && date.toDateString() === new Date().toDateString()
              
              return (
                <div
                  key={index}
                  className={`min-h-[60px] md:min-h-32 bg-white p-1.5 md:p-2 transition-all hover:bg-[var(--primary-soft)]/20 ${
                    isToday 
                      ? 'bg-gradient-to-br from-[var(--primary-soft)]/30 to-white border-2 border-[var(--primary)] shadow-sm' 
                      : date 
                        ? 'hover:shadow-sm' 
                        : 'bg-[var(--background-soft)]'
                  }`}
                >
                  {date && (
                    <>
                      <div className={`text-xs md:text-sm font-semibold mb-1 md:mb-2 ${
                        isToday 
                          ? 'text-[var(--primary)]' 
                          : date.toDateString() === new Date().toDateString() 
                            ? 'text-[var(--foreground)]' 
                            : 'text-[var(--foreground-soft)]'
                      }`}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-0.5 md:space-y-1">
                        {dayEvents.slice(0, 2).map(event => (
                          <div
                            key={event.id}
                            className={`group text-[9px] md:text-xs p-1 md:p-1.5 rounded md:rounded-lg border hover:shadow-md transition-all cursor-pointer ${getEventTypeColor(event.type)}`}
                            title={event.title}
                            onClick={() => openEditModal(event)}
                          >
                            <div className="hidden md:flex items-center justify-between gap-2">
                              <div className="font-medium truncate">
                                {event.startDate && new Date(event.startDate).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} {event.title}
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openEditModal(event)
                                  }}
                                  className="text-[10px] px-1 py-0.5 rounded bg-white/60 hover:bg-white text-[var(--primary)]"
                                >
                                  <EditIcon className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDelete(event.id)
                                  }}
                                  className="text-[10px] px-1 py-0.5 rounded bg-white/60 hover:bg-white text-[var(--error)]"
                                >
                                  🗑
                                </button>
                              </div>
                            </div>
                            <div className="md:hidden truncate font-medium leading-tight">
                              <span className="font-semibold">
                                {event.startDate && new Date(event.startDate).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="ml-1 opacity-80">{event.title.length > 8 ? event.title.slice(0, 8) + '...' : event.title}</span>
                            </div>
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[9px] md:text-xs text-[var(--muted)] font-medium px-1 py-0.5">
                            +{dayEvents.length - 2} еще
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Список событий */}
      <div className="glass-panel rounded-3xl">
        <div className="p-6 border-b border-white/40">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Лента событий</p>
          <h2 className="text-2xl font-semibold text-[var(--foreground)] mt-1">Ближайшие активности</h2>
          <p className="text-sm text-[var(--muted)]">Фокус на следующих шагах и быстрая реакция на изменения.</p>
        </div>
        <div className="p-6">
          {filteredEvents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <CalendarIcon className="w-12 h-12 text-[var(--muted)]" />
              </div>
              <h3 className="empty-state-title">Нет событий</h3>
              <p className="empty-state-description">
                {searchTerm || eventTypeFilter !== 'all'
                  ? 'Измените фильтры или очистите поиск, чтобы увидеть события'
                  : 'Создайте первое событие, чтобы начать планировать встречи и задачи'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents.slice(0, 10).map(event => {
                const startDate = new Date(event.startDate)
                return (
                  <div
                    key={event.id}
                    className="card-interactive group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getEventTypeColor(event.type)}`}>
                            {event.type === 'meeting' ? 'Встреча' : event.type === 'call' ? 'Звонок' : event.type === 'task' ? 'Задача' : 'Другое'}
                          </span>
                          <h4 className="font-semibold text-[var(--foreground)]">{event.title}</h4>
                        </div>
                        <div className="text-sm text-[var(--muted)] space-y-1">
                          <div className="flex items-center gap-2">
                            <span>🕐</span>
                            <span>
                              {startDate.toLocaleString('ru-RU', { 
                                day: 'numeric', 
                                month: 'long', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-2">
                              <span>📍</span>
                              <span>{event.location}</span>
                            </div>
                          )}
                          {event.contact && (
                            <div className="flex items-center gap-2">
                              <span>👤</span>
                              <span>{event.contact.name}</span>
                            </div>
                          )}
                        </div>
                        {event.description && (
                          <p className="text-sm text-[var(--muted-soft)] mt-2">{event.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditModal(event)}
                          className="text-[var(--primary)] hover:text-[var(--primary-hover)] text-sm font-medium"
                        >
                          Редактировать
                        </button>
                        <button
                          onClick={() => handleDelete(event.id)}
                          className="text-[var(--error)] hover:text-red-700 text-sm font-medium"
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно создания/редактирования события */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)] font-semibold mb-1">
                  {selectedEvent ? 'Редактирование' : 'Новое событие'}
                </p>
                <h3 className="text-2xl font-bold text-[var(--foreground)]">
                  {selectedEvent ? 'Изменить событие' : 'Создать событие'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-2 hover:bg-[var(--background-soft)] rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="modal-body">
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Название *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      required
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        Дата начала *
                      </label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                        required
                        className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        Время начала
                      </label>
                      <input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                        className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        Дата окончания
                      </label>
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                        className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        Время окончания
                      </label>
                      <input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                        className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        Тип события
                      </label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({...formData, type: e.target.value})}
                        className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                      >
                        <option value="meeting">Встреча</option>
                        <option value="call">Звонок</option>
                        <option value="task">Задача</option>
                        <option value="other">Другое</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        Клиент
                      </label>
                      <select
                        value={formData.contactId}
                        onChange={(e) => setFormData({...formData, contactId: e.target.value})}
                        className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                      >
                        <option value="">Не выбран</option>
                        {contacts.map(contact => (
                          <option key={contact.id} value={contact.id}>
                            {contact.name} ({contact.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Место
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Описание
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      rows={3}
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary text-sm"
                  disabled={isSubmitting}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn-primary text-sm btn-ripple"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Сохранение...' : (selectedEvent ? 'Сохранить' : 'Создать')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

