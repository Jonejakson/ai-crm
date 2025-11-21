'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useKeyboardShortcuts } from '@/lib/keyboard-shortcuts'
import Modal from '@/components/Modal'
import UserFilter from '@/components/UserFilter'
import AdvancedFilters from '@/components/AdvancedFilters'
import Skeleton, { SkeletonTable } from '@/components/Skeleton'
import ExportButton from '@/components/ExportButton'

interface Contact {
  id: number
  name: string
  email: string
  phone: string | null
  company: string | null
  createdAt: string
  user?: {
    id: number
    name: string
    email: string
  }
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    inn: ''
  })
  const [innLoading, setInnLoading] = useState(false)
  const [innError, setInnError] = useState('')
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [filters, setFilters] = useState<any>({})
  const [savedFilters, setSavedFilters] = useState<Array<{ id: number; name: string; filters: any }>>([])
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: ''
  })

  useEffect(() => {
    fetchContacts()
    // Загружаем сохраненные фильтры из localStorage
    const saved = localStorage.getItem('savedFilters_contacts')
    if (saved) {
      try {
        setSavedFilters(JSON.parse(saved))
      } catch (e) {
        console.error('Error loading saved filters:', e)
      }
    }
  }, [selectedUserId])

  // Клавиатурные сокращения для страницы контактов
  useKeyboardShortcuts([
    {
      key: 'n',
      ctrl: true,
      action: () => setIsModalOpen(true),
      description: 'Создать новый контакт',
    },
  ])

  const fetchContacts = async () => {
    try {
      const url = selectedUserId 
        ? `/api/contacts?userId=${selectedUserId}` 
        : '/api/contacts'
      const response = await fetch(url)
      const data = await response.json()
      setContacts(data)
    } catch (error) {
      console.error('Error fetching contacts:', error)
    } finally {
      setLoading(false)
    }
  }

  // Функция для открытия редактирования
  const handleEdit = (contact: Contact) => {
    setEditingContact(contact)
    setEditFormData({
      name: contact.name,
      email: contact.email,
      phone: contact.phone || '',
      company: contact.company || ''
    })
  }

// Функция сохранения изменений
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingContact) return

    try {
      const response = await fetch('/api/contacts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingContact.id,
          ...editFormData
        }),
      })

      if (response.ok) {
        await fetchContacts()
        setEditingContact(null)
        toast.success('Контакт успешно обновлен')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при обновлении контакта')
      }
    } catch (error) {
      console.error('Error updating contact:', error)
      toast.error('Ошибка при обновлении контакта')
    }
  }

// Функция удаления контакта
  const handleDelete = async (contactId: number) => {
    if (!confirm('Удалить контакт?')) return

    try {
      const response = await fetch(`/api/contacts?id=${contactId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchContacts()
        toast.success('Контакт успешно удален')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при удалении контакта')
      }
    } catch (error) {
      console.error('Error deleting contact:', error)
      toast.error('Ошибка при удалении контакта')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await fetchContacts() // Обновляем список
        setIsModalOpen(false)
        setFormData({ name: '', email: '', phone: '', company: '', inn: '' })
        setInnError('')
        toast.success('Контакт успешно создан')
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Ошибка при создании контакта')
      }
    } catch (error) {
      console.error('Error creating contact:', error)
      toast.error('Ошибка при создании контакта')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  // Функция поиска компании по ИНН
  const handleInnSearch = async (inn: string) => {
    const cleanInn = inn.replace(/\D/g, '')
    
    // Если ИНН меньше 10 цифр, не делаем запрос
    if (cleanInn.length < 10) {
      setInnError('')
      return
    }

    setInnLoading(true)
    setInnError('')

    try {
      const response = await fetch(`/api/company/by-inn?inn=${cleanInn}`)
      const data = await response.json()

      if (response.ok && data.name) {
        setFormData({
          ...formData,
          company: data.name,
          inn: cleanInn
        })
      } else {
        setInnError(data.error || 'Компания не найдена')
      }
    } catch (error) {
      console.error('Error searching company by INN:', error)
      setInnError('Ошибка при поиске компании')
    } finally {
      setInnLoading(false)
    }
  }

  const handleInnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFormData({
      ...formData,
      inn: value
    })
    
    // Делаем запрос когда ИНН полностью введен (10 или 12 цифр)
    const cleanInn = value.replace(/\D/g, '')
    if (cleanInn.length === 10 || cleanInn.length === 12) {
      handleInnSearch(cleanInn)
    } else {
      setInnError('')
    }
  }

  // Применяем фильтры
  const filteredContacts = contacts.filter(contact => {
    // Поиск по тексту
    const matchesSearch = !search || 
      contact.name.toLowerCase().includes(search.toLowerCase()) ||
      contact.email.toLowerCase().includes(search.toLowerCase()) ||
      contact.company?.toLowerCase().includes(search.toLowerCase())

    if (!matchesSearch) return false

    // Фильтр по дате создания
    if (filters.dateRange) {
      const contactDate = new Date(contact.createdAt)
      const startDate = filters.dateRange.start ? new Date(filters.dateRange.start) : null
      const endDate = filters.dateRange.end ? new Date(filters.dateRange.end) : null
      
      if (startDate && contactDate < startDate) return false
      if (endDate) {
        const endDateEnd = new Date(endDate)
        endDateEnd.setHours(23, 59, 59, 999)
        if (contactDate > endDateEnd) return false
      }
    }

    return true
  })

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <Skeleton variant="text" width={200} height={24} />
            <Skeleton variant="text" width={300} height={16} />
          </div>
          <Skeleton variant="rectangular" width={150} height={40} />
        </div>
        <div className="glass-panel p-6 rounded-3xl">
          <SkeletonTable />
        </div>
      </div>
    )
  }

  const newContacts = contacts.filter(contact => {
    const created = new Date(contact.createdAt)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return created >= weekAgo
  }).length
  const contactsWithCompany = contacts.filter(contact => contact.company).length
  const assignedContacts = contacts.filter(contact => contact.user).length

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)] font-semibold">Клиенты</p>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Контакты компании</h1>
          <p className="text-sm text-[var(--muted)]">Быстрый поиск, фильтрация по менеджерам и создание карточек.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton 
            entityType="contacts" 
            label="Экспорт CSV"
            className="text-sm"
          />
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary text-sm"
          >
            + Добавить клиента
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: 'Всего контактов', value: contacts.length, note: `+${newContacts} за 7 дней` },
          { label: 'С компанией', value: contactsWithCompany, note: `${Math.round((contactsWithCompany / Math.max(contacts.length, 1)) * 100)}% базы` },
          { label: 'Закреплено за менеджерами', value: assignedContacts, note: `${assignedContacts ? Math.round((assignedContacts / Math.max(contacts.length, 1)) * 100) : 0}% активны` },
        ].map((card) => (
          <div key={card.label} className="stat-card">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)] mb-1">{card.label}</p>
            <p className="text-2xl font-semibold text-[var(--foreground)]">{card.value}</p>
            <p className="text-sm text-[var(--muted)]">{card.note}</p>
          </div>
        ))}
      </div>

      <div className="glass-panel rounded-3xl space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Поиск по имени, email или компании..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              className="btn-secondary text-sm"
              onClick={() => setIsFiltersOpen((prev) => !prev)}
            >
              {isFiltersOpen ? 'Скрыть фильтры' : 'Фильтры'}
            </button>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[240px]">
            <UserFilter 
              selectedUserId={selectedUserId} 
              onUserChange={setSelectedUserId} 
            />
          </div>
        </div>
        {isFiltersOpen && (
          <AdvancedFilters
            entityType="contacts"
            onFilterChange={setFilters}
            savedFilters={savedFilters}
            onSaveFilter={(name, filterData) => {
              const newFilter = {
                id: Date.now(),
                name,
                filters: filterData,
              }
              const updated = [...savedFilters, newFilter]
              setSavedFilters(updated)
              localStorage.setItem('savedFilters_contacts', JSON.stringify(updated))
            }}
            onDeleteFilter={(id) => {
              const updated = savedFilters.filter(f => f.id !== id)
              setSavedFilters(updated)
              localStorage.setItem('savedFilters_contacts', JSON.stringify(updated))
            }}
          />
        )}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Имя</th>
              <th>Email</th>
              <th>Телефон</th>
              <th>Компания</th>
              <th>Дата</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredContacts.map((contact) => (
              <tr key={contact.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)]">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <a href={`/contacts/${contact.id}`} className="font-medium text-[var(--foreground)] hover:text-[var(--primary)]">
                        {contact.name}
                      </a>
                      {contact.user && (
                        <span className="text-xs text-[var(--muted)]">Менеджер: {contact.user.name}</span>
                      )}
                    </div>
                  </div>
                </td>
                <td>{contact.email}</td>
                <td>{contact.phone || '—'}</td>
                <td>{contact.company || '—'}</td>
                <td>{new Date(contact.createdAt).toLocaleDateString('ru-RU')}</td>
                <td>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleEdit(contact)}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={() => handleDelete(contact.id)}
                      className="btn-ghost text-xs px-3 py-1.5 text-red-500 hover:text-red-600"
                    >
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredContacts.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">{search ? '🔍' : '👥'}</div>
            <h3 className="empty-state-title">
              {search ? 'Контакты не найдены' : 'Нет контактов'}
            </h3>
            <p className="empty-state-description">
              {search 
                ? 'Попробуйте изменить параметры поиска'
                : 'Добавьте первый контакт, чтобы начать работу с клиентской базой'}
            </p>
          </div>
        )}
      </div>

      {/* Модальное окно добавления контакта */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Добавить клиента"
        size="md"
      >

        <form onSubmit={handleSubmit} className="space-y-4">
                  {['name', 'email', 'phone'].map((field) => (
                    <div key={field}>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        {field === 'name' ? 'Имя *' :
                         field === 'email' ? 'Email *' :
                         'Телефон'}
                      </label>
                      <input
                        type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
                        name={field}
                        value={(formData as any)[field]}
                        onChange={handleChange}
                        required={field === 'name' || field === 'email'}
                        className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                      />
                    </div>
                  ))}
                  
                  {/* Поле ИНН */}
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                      ИНН
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        name="inn"
                        value={formData.inn}
                        onChange={handleInnChange}
                        placeholder="Введите ИНН (10 или 12 цифр)"
                        maxLength={12}
                        className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                      />
                      {innLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="loading-spinner"></div>
                        </div>
                      )}
                    </div>
                    {innError && (
                      <p className="mt-1 text-xs text-red-500">{innError}</p>
                    )}
                  </div>

                  {/* Поле Компания */}
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                      Компания
                    </label>
                    <input
                      type="text"
                      name="company"
                      value={formData.company}
                      onChange={handleChange}
                      placeholder="Заполнится автоматически по ИНН"
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                    />
                  </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="btn-secondary text-sm"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn-primary text-sm"
            >
              Добавить
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!editingContact}
        onClose={() => setEditingContact(null)}
        title="Изменить клиента"
        size="md"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="space-y-4">
                  {['name', 'email', 'phone', 'company'].map((field) => (
                    <div key={field}>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        {field === 'name' ? 'Имя *' :
                         field === 'email' ? 'Email *' :
                         field === 'phone' ? 'Телефон' : 'Компания'}
                      </label>
                      <input
                        type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
                        name={field}
                        value={(editFormData as any)[field]}
                        onChange={(e) => setEditFormData({ ...editFormData, [field]: e.target.value })}
                        required={field === 'name' || field === 'email'}
                        className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                      />
                    </div>
                  ))}
                </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setEditingContact(null)}
              className="btn-secondary text-sm"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn-primary text-sm"
            >
              Сохранить
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}