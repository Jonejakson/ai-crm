'use client'

import { useState, useEffect } from 'react'

interface Dialog {
  id: number
  message: string
  sender: string
  platform?: 'TELEGRAM' | 'WHATSAPP' | 'INTERNAL'
  externalId?: string | null
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
  const [searchTerm, setSearchTerm] = useState('')

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

  const filteredDialogs = (Array.isArray(dialogs) ? dialogs : [])
    .filter(dialog => {
      if (selectedContact !== 'all' && dialog.contact?.id !== Number(selectedContact)) {
        return false
      }
      if (!searchTerm.trim()) return true
      const term = searchTerm.toLowerCase()
      return (
        dialog.message.toLowerCase().includes(term) ||
        dialog.contact?.name.toLowerCase().includes(term) ||
        (dialog.contact?.email?.toLowerCase().includes(term)) ||
        dialog.sender.toLowerCase().includes(term)
      )
    })

  const dialogsByContact = filteredDialogs.reduce((acc, dialog) => {
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
  }, {} as Record<number, { contact: Contact; dialogs: Dialog[] }>)

  const totalMessages = dialogs.length
  const totalContacts = Array.isArray(dialogs)
    ? new Set(dialogs.map(dialog => dialog.contact?.id).filter((id): id is number => typeof id === 'number')).size
    : 0
  const todayMessages = filteredDialogs.filter(dialog => {
    const created = new Date(dialog.createdAt)
    const now = new Date()
    return created.toDateString() === now.toDateString()
  }).length
  const outgoingMessages = filteredDialogs.filter(dialog => dialog.sender === 'user').length
  const incomingMessages = filteredDialogs.filter(dialog => dialog.sender !== 'user').length
  const responseRatio = outgoingMessages > 0 ? Math.round((incomingMessages / outgoingMessages) * 100) : 0

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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Коммуникации</p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Диалоги с клиентами</h1>
          <p className="text-sm text-[var(--muted)]">
            Отслеживайте переписку и быстро отвечайте на обращения.
          </p>
        </div>
        <div className="text-sm text-[var(--muted)]">
          Всего сообщений: <span className="font-semibold text-[var(--foreground)]">{totalMessages}</span>
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-6 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg">🔍</span>
            <input
              type="text"
              placeholder="Поиск по тексту сообщения, имени или email клиента..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border)] bg-white/90 pl-12 pr-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
            />
          </div>
          <div className="min-w-[220px]">
            <select
              value={selectedContact}
              onChange={(e) => setSelectedContact(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
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
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          Найдено сообщений: {filteredDialogs.length}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Уникальных клиентов', value: totalContacts, note: 'Ведут диалог' },
          { label: 'Сообщений сегодня', value: todayMessages, note: 'За последние 24 часа' },
          { label: 'Исходящие/Входящие', value: `${outgoingMessages}/${incomingMessages}`, note: `Ответы ${responseRatio}%` },
          { label: 'Сообщений в выборке', value: filteredDialogs.length, note: 'С учётом поиска и фильтра' },
        ].map(card => (
          <div key={card.label} className="stat-card">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)] mb-1">{card.label}</p>
            <p className="stat-card-value">{card.value}</p>
            <p className="text-sm text-[var(--muted)]">{card.note}</p>
          </div>
        ))}
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
                ? 'Нет сообщений для отображения'
                : 'Нет сообщений с выбранным клиентом'}
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
                    <div className={`text-xs mt-2 flex items-center gap-2 ${dialog.sender === 'user' ? 'text-white/70' : 'text-[var(--muted)]'}`}>
                      <span>{dialog.sender === 'user' ? 'Вы' : 'Клиент'}</span>
                      {dialog.platform && dialog.platform !== 'INTERNAL' && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          dialog.platform === 'TELEGRAM' 
                            ? 'bg-blue-100 text-blue-700' 
                            : dialog.platform === 'WHATSAPP'
                            ? 'bg-green-100 text-green-700'
                            : ''
                        }`}>
                          {dialog.platform === 'TELEGRAM' ? '📱 Telegram' : dialog.platform === 'WHATSAPP' ? '💬 WhatsApp' : ''}
                        </span>
                      )}
                      <span>•</span>
                      <span>{new Date(dialog.createdAt).toLocaleDateString('ru-RU')}</span>
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