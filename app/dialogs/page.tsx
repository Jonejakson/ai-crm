'use client'

import { useState, useEffect } from 'react'

interface Dialog {
  id: number
  message: string
  sender: string
  createdAt: string
  contact: {
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

export default function DialogsPage() {
  const [dialogs, setDialogs] = useState<Dialog[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedContact, setSelectedContact] = useState<string>('all')
  const [newMessage, setNewMessage] = useState('')
  const [selectedContactForMessage, setSelectedContactForMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [contactsRes, dialogsRes] = await Promise.all([
        fetch('/api/contacts').then(res => res.json()),
        fetch('/api/dialogs').then(res => res.json())
      ])
      setContacts(Array.isArray(contactsRes) ? contactsRes : [])
      setDialogs(Array.isArray(dialogsRes) ? dialogsRes : [])
    } catch (error) {
      console.error('Error fetching data:', error)
      setContacts([])
      setDialogs([])
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    if (!newMessage.trim() || !selectedContactForMessage) {
      setError('Заполните все поля')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/dialogs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: newMessage.trim(),
          contactId: parseInt(selectedContactForMessage),
          sender: 'user'
        })
      })

      if (!response.ok) {
        let errorMessage = 'Ошибка при отправке сообщения'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (parseError) {
          // Если не удалось распарсить JSON, используем текст ответа
          const text = await response.text().catch(() => '')
          errorMessage = text || `HTTP ${response.status}: ${response.statusText}`
        }
        setError(errorMessage)
        console.error('Error sending message:', errorMessage)
        return
      }

      // Обновляем список диалогов с сервера
      await fetchData()
      
      // Очищаем форму
      setNewMessage('')
      setSelectedContactForMessage('')
      setError(null)
      
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка сети'
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredDialogs = selectedContact === 'all' 
    ? (Array.isArray(dialogs) ? dialogs : [])
    : (Array.isArray(dialogs) ? dialogs.filter(dialog => dialog.contact?.id === Number(selectedContact)) : [])

  const dialogsByContact = Array.isArray(filteredDialogs) ? filteredDialogs.reduce((acc, dialog) => {
    if (!dialog.contact) return acc
    const contactId = dialog.contact.id
    if (!acc[contactId]) {
      acc[contactId] = {
        contact: dialog.contact,
        dialogs: []
      }
    }
    acc[contactId].dialogs.push(dialog)
    return acc
  }, {} as Record<number, { contact: Contact; dialogs: Dialog[] }>) : {}

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-[var(--muted)]">Загрузка диалогов...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Диалоги</p>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Сообщения с клиентами</h1>
          <p className="text-sm text-[var(--muted)]">Всего сообщений: {dialogs.length}</p>
        </div>
      </div>

      <div className="glass-panel px-6 py-5 rounded-3xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <label className="text-sm font-semibold text-[var(--muted)]">
            Фильтр по клиенту:
          </label>
          <select
            value={selectedContact}
            onChange={(e) => setSelectedContact(e.target.value)}
            className="w-full md:w-auto rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
          >
            <option value="all">Все клиенты</option>
            {contacts.map(contact => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="glass-panel rounded-3xl">
        <div className="p-6 border-b border-white/40">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Новое сообщение</p>
          <h3 className="text-xl font-semibold text-slate-900 mt-1">Отправить сообщение</h3>
        </div>
        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-[var(--error-soft)] border border-[var(--error)]/30 rounded-xl text-[var(--error)] text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSendMessage} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Клиент *
                </label>
                <select
                  value={selectedContactForMessage}
                  onChange={(e) => setSelectedContactForMessage(e.target.value)}
                  required
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                >
                  <option value="">Выберите клиента</option>
                  {contacts.map(contact => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name} ({contact.email})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Сообщение *
                </label>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Введите сообщение..."
                  required
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="space-y-6">
        {Object.values(dialogsByContact).length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <h3 className="empty-state-title">
              {selectedContact === 'all' ? 'Нет сообщений' : 'Нет сообщений с выбранным клиентом'}
            </h3>
            <p className="empty-state-description">
              {selectedContact === 'all' 
                ? 'Начните диалог с клиентом, отправив первое сообщение'
                : 'Выберите другого клиента или отправьте новое сообщение'}
            </p>
          </div>
        ) : (
          Object.values(dialogsByContact).map(({ contact, dialogs }) => (
            <div key={contact.id} className="glass-panel rounded-3xl">
              <div className="p-6 border-b border-white/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] rounded-full flex items-center justify-center text-white font-semibold text-lg shadow-lg">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--foreground)]">{contact.name}</h3>
                      <p className="text-sm text-[var(--muted)]">{contact.email}</p>
                    </div>
                  </div>
                  <a 
                    href={`/contacts/${contact.id}`}
                    className="text-[var(--primary)] hover:text-[var(--primary-hover)] text-sm font-medium transition-colors"
                  >
                    Перейти к клиенту →
                  </a>
                </div>
              </div>

              <div className="p-6 space-y-3">
                {dialogs
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                  .map((dialog) => (
                  <div
                    key={dialog.id}
                    className={`p-4 rounded-2xl max-w-3/4 transition-all ${
                      dialog.sender === 'user'
                        ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white ml-auto shadow-lg'
                        : 'bg-white/80 border border-[var(--border)] mr-auto'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <p className={`${dialog.sender === 'user' ? 'text-white' : 'text-[var(--foreground)]'}`}>
                        {dialog.message}
                      </p>
                      <span className={`text-xs whitespace-nowrap ${dialog.sender === 'user' ? 'text-white/70' : 'text-[var(--muted)]'}`}>
                        {new Date(dialog.createdAt).toLocaleTimeString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className={`text-xs mt-2 ${dialog.sender === 'user' ? 'text-white/70' : 'text-[var(--muted)]'}`}>
                      {dialog.sender === 'user' ? 'Вы' : 'Клиент'} • 
                      {new Date(dialog.createdAt).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}