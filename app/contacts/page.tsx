'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import Modal from '@/components/Modal'
import UserFilter from '@/components/UserFilter'
import AdvancedFilters from '@/components/AdvancedFilters'
import Skeleton, { SkeletonTable } from '@/components/Skeleton'

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)] font-semibold">Клиенты</p>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Контакты компании</h1>
          <p className="text-sm text-[var(--muted)]">Управляйте клиентской базой, фильтруйте по менеджерам, добавляйте новых.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => {
              window.location.href = '/api/export/contacts?format=excel'
            }}
            className="btn-secondary flex items-center gap-2"
          >
            📥 Экспорт CSV
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary"
          >
            + Добавить клиента
          </button>
        </div>
      </div>

      <div className="glass-panel px-6 py-5 rounded-3xl">
        <UserFilter 
          selectedUserId={selectedUserId} 
          onUserChange={setSelectedUserId} 
        />
      </div>

      <div className="glass-panel rounded-3xl p-5 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            type="text"
            placeholder="Поиск по имени, email или компании..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[var(--primary)] focus:ring-0"
          />
        </div>
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
            setSavedFilters([...savedFilters, newFilter])
            // Сохраняем в localStorage
            localStorage.setItem('savedFilters_contacts', JSON.stringify([...savedFilters, newFilter]))
          }}
          onDeleteFilter={(id) => {
            const updated = savedFilters.filter(f => f.id !== id)
            setSavedFilters(updated)
            localStorage.setItem('savedFilters_contacts', JSON.stringify(updated))
          }}
        />
      </div>

      <div className="table-container">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-[var(--background-soft)] to-white/80 text-left text-xs uppercase tracking-[0.35em] text-slate-400">
            <tr>
              <th className="px-6 py-4 font-semibold">Имя</th>
              <th className="px-6 py-4 font-semibold">Email</th>
              <th className="px-6 py-4 font-semibold">Телефон</th>
              <th className="px-6 py-4 font-semibold">Компания</th>
              <th className="px-6 py-4 font-semibold">Дата</th>
              <th className="px-6 py-4 font-semibold">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-soft)]">
            {filteredContacts.map((contact) => (
              <tr key={contact.id} className="table-row-hover">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="mr-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)]">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <a href={`/contacts/${contact.id}`} className="font-medium text-[var(--primary)] hover:underline">
                      {contact.name}
                    </a>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                  {contact.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                  {contact.phone || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                  {contact.company || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                  {new Date(contact.createdAt).toLocaleDateString('ru-RU')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleEdit(contact)}
                      className="text-blue-500 hover:text-blue-700"
                      title="Редактировать"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(contact.id)}
                      className="text-red-500 hover:text-red-700"
                      title="Удалить"
                    >
                      🗑️
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
                </div>
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

      {editingContact && (
        <div className="modal-overlay" onClick={() => setEditingContact(null)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Редактирование</p>
                <h3 className="text-xl font-semibold text-slate-900">Изменить клиента</h3>
              </div>
              <button
                onClick={() => setEditingContact(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
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
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setEditingContact(null)}
                  className="btn-secondary text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn-primary text-sm btn-ripple"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}