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
    company: ''
  })
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: ''
  })

  useEffect(() => {
    fetchContacts()
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
      }
    } catch (error) {
      console.error('Error updating contact:', error)
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
      }
    } catch (error) {
      console.error('Error deleting contact:', error)
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
        setFormData({ name: '', email: '', phone: '', company: '' })
      }
    } catch (error) {
      console.error('Error creating contact:', error)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(search.toLowerCase()) ||
    contact.email.toLowerCase().includes(search.toLowerCase()) ||
    contact.company?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return <div className="flex justify-center p-8">Загрузка...</div>
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Клиенты</p>
          <h1 className="text-3xl font-semibold text-slate-900">Контакты компании</h1>
          <p className="text-sm text-slate-500">Управляйте клиентской базой, фильтруйте по менеджерам, добавляйте новых.</p>
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

      <div className="glass-panel rounded-3xl p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            type="text"
            placeholder="Поиск по имени, email или компании..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[var(--primary)] focus:ring-0"
          />
        </div>
      </div>

      <div className="glass-panel rounded-3xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-white/60 text-left text-xs uppercase tracking-[0.35em] text-slate-400">
            <tr>
              <th className="px-6 py-4">Имя</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Телефон</th>
              <th className="px-6 py-4">Компания</th>
              <th className="px-6 py-4">Дата</th>
              <th className="px-6 py-4">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/50">
            {filteredContacts.map((contact) => (
              <tr key={contact.id} className="hover:bg-white/60 transition-colors">
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
          <div className="py-12 text-center text-sm text-slate-500">
            {search ? 'Контакты не найдены' : 'Нет контактов'}
          </div>
        )}
      </div>

      {/* Модальное окно добавления контакта */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/40 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Новый контакт</p>
                <h3 className="text-xl font-semibold text-slate-900">Добавить клиента</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              {['name', 'email', 'phone', 'company'].map((field) => (
                <div key={field}>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    {field === 'name' ? 'Имя *' :
                     field === 'email' ? 'Email *' :
                     field === 'phone' ? 'Телефон' : 'Компания'}
                  </label>
                  <input
                    type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
                    name={field}
                    value={(formData as any)[field]}
                    onChange={handleChange}
                    required={field === 'name' || field === 'email'}
                    className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
                  />
                </div>
              ))}

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
          </div>
        </div>
      )}

      {editingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center justify-between border-б border-white/40 pb-4">
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

            <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
              {['name', 'email', 'phone', 'company'].map((field) => (
                <div key={field}>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
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
                    className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
                  />
                </div>
              ))}

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
          </div>
        </div>
      )}
    </div>
  )
}