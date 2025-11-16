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
    return <div className="flex justify-center p-8">Загрузка...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Диалоги</h1>
        <div className="text-sm text-gray-500">
          Всего сообщений: {dialogs.length}
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">
            Фильтр по клиенту:
          </label>
          <select
            value={selectedContact}
            onChange={(e) => setSelectedContact(e.target.value)}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-4">Отправить сообщение</h3>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSendMessage} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Клиент *
              </label>
              <select
                value={selectedContactForMessage}
                onChange={(e) => setSelectedContactForMessage(e.target.value)}
                required
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Сообщение *
              </label>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Введите сообщение..."
                required
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Отправка...' : 'Отправить'}
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-6">
        {Object.values(dialogsByContact).length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {selectedContact === 'all' ? 'Нет сообщений' : 'Нет сообщений с выбранным клиентом'}
          </div>
        ) : (
          Object.values(dialogsByContact).map(({ contact, dialogs }) => (
            <div key={contact.id} className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{contact.name}</h3>
                      <p className="text-sm text-gray-500">{contact.email}</p>
                    </div>
                  </div>
                  <a 
                    href={`/contacts/${contact.id}`}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Перейти к клиенту →
                  </a>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {dialogs
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                  .map((dialog) => (
                  <div
                    key={dialog.id}
                    className={`p-3 rounded-lg max-w-3/4 ${
                      dialog.sender === 'user'
                        ? 'bg-blue-100 ml-auto'
                        : 'bg-gray-100 mr-auto'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-gray-900">{dialog.message}</p>
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                        {new Date(dialog.createdAt).toLocaleTimeString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
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