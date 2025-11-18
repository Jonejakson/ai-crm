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
      meeting: 'bg-blue-100 border-blue-300 text-blue-800',
      call: 'bg-green-100 border-green-300 text-green-800',
      task: 'bg-orange-100 border-orange-300 text-orange-800',
      other: 'bg-gray-100 border-gray-300 text-gray-800',
    }
    return colors[type] || colors.other
  }

  const days = getDaysInMonth(currentDate)
  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

  if (loading) {
    return <div className="flex justify-center p-8">Загрузка...</div>
  }

  return (
    <div className="space-y-6">
      {/* Заголовок и навигация */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h1>
        </div>
      </div>
      
      {/* Фильтр по менеджеру (только для админа) */}
      <UserFilter 
        selectedUserId={selectedUserId} 
        onUserChange={setSelectedUserId} 
      />
      
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="flex space-x-2">
            <button
              onClick={() => {
                const newDate = new Date(currentDate)
                newDate.setMonth(newDate.getMonth() - 1)
                setCurrentDate(newDate)
              }}
              className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ←
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Сегодня
            </button>
            <button
              onClick={() => {
                const newDate = new Date(currentDate)
                newDate.setMonth(newDate.getMonth() + 1)
                setCurrentDate(newDate)
              }}
              className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              →
            </button>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setView('month')}
            className={`px-4 py-2 rounded-lg ${view === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
          >
            Месяц
          </button>
          <button
            onClick={() => setView('week')}
            className={`px-4 py-2 rounded-lg ${view === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
          >
            Неделя
          </button>
          <button 
            onClick={() => {
              window.location.href = '/api/export/events?format=excel'
            }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
          >
            <span>📥</span>
            <span>Экспорт CSV</span>
          </button>
          <button
            onClick={() => {
              window.open('/api/integrations/calendar/ics', '_blank')
            }}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center space-x-2"
          >
            <span>📅</span>
            <span>iCal / Google</span>
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
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            + Новое событие
          </button>
        </div>
      </div>

      {/* Календарь */}
      {view === 'month' && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="grid grid-cols-7 gap-px bg-gray-200">
            {dayNames.map(day => (
              <div key={day} className="bg-gray-50 p-2 text-center text-sm font-semibold text-gray-700">
                {day}
              </div>
            ))}
            {days.map((date, index) => {
              const dayEvents = getEventsForDate(date)
              const isToday = date && date.toDateString() === new Date().toDateString()
              
              return (
                <div
                  key={index}
                  className={`min-h-24 bg-white p-1 ${isToday ? 'bg-blue-50' : ''}`}
                >
                  {date && (
                    <>
                      <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map(event => (
                          <div
                            key={event.id}
                            className={`text-xs p-1 rounded border cursor-pointer hover:opacity-80 ${getEventTypeColor(event.type)}`}
                            onClick={() => openEditModal(event)}
                            title={event.title}
                          >
                            {event.startDate && new Date(event.startDate).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-gray-500">
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
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold mb-4">Ближайшие события</h2>
        <div className="space-y-3">
          {events.slice(0, 10).map(event => {
            const startDate = new Date(event.startDate)
            return (
              <div
                key={event.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded ${getEventTypeColor(event.type)}`}>
                      {event.type}
                    </span>
                    <h4 className="font-semibold">{event.title}</h4>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {startDate.toLocaleString('ru-RU', { 
                      day: 'numeric', 
                      month: 'long', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                    {event.location && ` • ${event.location}`}
                    {event.contact && ` • ${event.contact.name}`}
                  </div>
                  {event.description && (
                    <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => openEditModal(event)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Редактировать
                  </button>
                  <button
                    onClick={() => handleDelete(event.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            )
          })}
          {events.length === 0 && (
            <p className="text-gray-500 text-center py-8">Нет событий</p>
          )}
        </div>
      </div>

      {/* Модальное окно создания/редактирования события */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {selectedEvent ? 'Редактировать событие' : 'Новое событие'}
              </h3>
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
                  Название *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  required
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Дата начала *
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                    required
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Время начала
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Дата окончания
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Время окончания
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Тип события
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="meeting">Встреча</option>
                    <option value="call">Звонок</option>
                    <option value="task">Задача</option>
                    <option value="other">Другое</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Клиент
                  </label>
                  <select
                    value={formData.contactId}
                    onChange={(e) => setFormData({...formData, contactId: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Место
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Описание
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
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

