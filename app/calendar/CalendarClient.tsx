'use client'

import { useState, useEffect } from 'react'
import UserFilter from '@/components/UserFilter'

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
    try {
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime || '09:00'}`)
      const endDateTime = formData.endDate && formData.endTime 
        ? new Date(`${formData.endDate}T${formData.endTime}`)
        : formData.endDate
          ? new Date(`${formData.endDate}T${formData.startTime || '10:00'}`)
          : null

      const url = selectedEvent ? '/api/events' : '/api/events'
      const method = selectedEvent ? 'PUT' : 'POST'
      const body = selectedEvent
        ? {
            id: selectedEvent.id,
            title: formData.title,
            description: formData.description || null,
            startDate: startDateTime.toISOString(),
            endDate: endDateTime ? endDateTime.toISOString() : null,
            location: formData.location || null,
            type: formData.type,
            contactId: formData.contactId || null,
          }
        : {
            title: formData.title,
            description: formData.description || null,
            startDate: startDateTime.toISOString(),
            endDate: endDateTime ? endDateTime.toISOString() : null,
            location: formData.location || null,
            type: formData.type,
            contactId: formData.contactId || null,
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
      }
    } catch (error) {
      console.error('Error saving event:', error)
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

  const getEventsForDate = (date: Date | null) => {
    if (!date) return []
    const dateStr = date.toISOString().split('T')[0]
    return events.filter(event => {
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Календарь</p>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h1>
          <p className="text-sm text-[var(--muted)]">Управляйте событиями и встречами</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => {
              window.location.href = '/api/export/events?format=excel'
            }}
            className="btn-secondary flex items-center gap-2"
          >
            📥 Экспорт CSV
          </button>
          <button
            onClick={() => {
              window.open('/api/integrations/calendar/ics', '_blank')
            }}
            className="btn-secondary flex items-center gap-2"
          >
            📅 iCal / Google
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
            className="btn-primary"
          >
            + Новое событие
          </button>
        </div>
      </div>

      {/* Фильтр по менеджеру */}
      <div className="glass-panel px-6 py-5 rounded-3xl">
        <UserFilter 
          selectedUserId={selectedUserId} 
          onUserChange={setSelectedUserId} 
        />
      </div>
      
      {/* Навигация календаря */}
      <div className="glass-panel p-6 rounded-3xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newDate = new Date(currentDate)
                newDate.setMonth(newDate.getMonth() - 1)
                setCurrentDate(newDate)
              }}
              className="btn-secondary p-2"
            >
              ←
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="btn-secondary"
            >
              Сегодня
            </button>
            <button
              onClick={() => {
                const newDate = new Date(currentDate)
                newDate.setMonth(newDate.getMonth() + 1)
                setCurrentDate(newDate)
              }}
              className="btn-secondary p-2"
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
            >
              Месяц
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                view === 'week' 
                  ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-lg' 
                  : 'bg-white text-[var(--muted)] border border-[var(--border)] hover:border-[var(--primary)]'
              }`}
            >
              Неделя
            </button>
          </div>
        </div>
      </div>

      {/* Календарь */}
      {view === 'month' && (
        <div className="glass-panel rounded-3xl overflow-hidden">
          <div className="grid grid-cols-7 gap-px bg-[var(--border-soft)]">
            {dayNames.map(day => (
              <div key={day} className="bg-gradient-to-r from-[var(--background-soft)] to-white/80 p-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                {day}
              </div>
            ))}
            {days.map((date, index) => {
              const dayEvents = getEventsForDate(date)
              const isToday = date && date.toDateString() === new Date().toDateString()
              
              return (
                <div
                  key={index}
                  className={`min-h-32 bg-white p-2 transition-all hover:bg-[var(--primary-soft)]/20 ${
                    isToday ? 'bg-gradient-to-br from-[var(--primary-soft)]/30 to-white border-2 border-[var(--primary)]' : ''
                  }`}
                >
                  {date && (
                    <>
                      <div className={`text-sm font-semibold mb-2 ${
                        isToday 
                          ? 'text-[var(--primary)]' 
                          : date.toDateString() === new Date().toDateString() 
                            ? 'text-[var(--foreground)]' 
                            : 'text-[var(--foreground-soft)]'
                      }`}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map(event => (
                          <div
                            key={event.id}
                            className={`text-xs p-1.5 rounded-lg border cursor-pointer hover:shadow-md transition-all ${getEventTypeColor(event.type)}`}
                            onClick={() => openEditModal(event)}
                            title={event.title}
                          >
                            <div className="font-medium truncate">
                              {event.startDate && new Date(event.startDate).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} {event.title}
                            </div>
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-[var(--muted)] font-medium px-1">
                            +{dayEvents.length - 3} еще
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
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">События</p>
          <h2 className="text-xl font-semibold text-slate-900 mt-1">Ближайшие события</h2>
        </div>
        <div className="p-6">
          {events.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <h3 className="empty-state-title">Нет событий</h3>
              <p className="empty-state-description">
                Создайте первое событие, чтобы начать планировать встречи и задачи
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.slice(0, 10).map(event => {
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

            <form onSubmit={handleSubmit}>
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
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn-primary text-sm btn-ripple"
                >
                  {selectedEvent ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

