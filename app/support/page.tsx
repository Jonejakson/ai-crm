'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

type SupportTicket = {
  id: number
  ticketId: string
  subject: string
  message: string
  email: string
  status: string
  createdAt: string
  updatedAt: string
  unreadMessagesCount?: number
  messages: Array<{
    id: number
    message: string
    fromEmail: string
    fromName: string | null
    isFromAdmin: boolean
    isRead?: boolean
    createdAt: string
    files?: Array<{
      id: number
      name: string
      originalName: string
      url: string
      size: number
      mimeType: string
    }>
  }>
}

export default function SupportPage() {
  const { data: session } = useSession()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState(session?.user?.email || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [newTicketFiles, setNewTicketFiles] = useState<File[]>([])
  const [uploadingNewTicketFiles, setUploadingNewTicketFiles] = useState(false)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [expandedTickets, setExpandedTickets] = useState<Set<number>>(new Set())
  const [replyMessage, setReplyMessage] = useState<Record<number, string>>({})
  const [replying, setReplying] = useState<Record<number, boolean>>({})
  const [attachedFiles, setAttachedFiles] = useState<Record<number, File[]>>({})
  const [uploadingFiles, setUploadingFiles] = useState<Record<number, boolean>>({})

  const loadTickets = async () => {
    try {
      setLoadingTickets(true)
      const res = await fetch('/api/support')
      if (!res.ok) {
        throw new Error('Не удалось загрузить тикеты')
      }
      const data = await res.json()
      setTickets(data.tickets || [])
    } catch (err) {
      console.error('Ошибка загрузки тикетов:', err)
    } finally {
      setLoadingTickets(false)
    }
  }

  useEffect(() => {
    if (session?.user) {
      loadTickets()
    }
  }, [session])

  const handleNewTicketFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)
    
    // Проверка размера файлов (10 МБ)
    const maxSize = 10 * 1024 * 1024 // 10 МБ
    for (const file of fileArray) {
      if (file.size > maxSize) {
        setError(`Файл "${file.name}" превышает лимит 10 МБ`)
        return
      }
    }

    setNewTicketFiles(prev => [...prev, ...fileArray])

    // Очищаем input
    if (e.target) {
      e.target.value = ''
    }
  }

  const removeNewTicketFile = (index: number) => {
    setNewTicketFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message, email }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Не удалось отправить тикет')
      }

      // Если есть файлы и сообщение создано, загружаем их
      if (newTicketFiles.length > 0 && data.ticket?.firstMessageId) {
        setUploadingNewTicketFiles(true)
        try {
          for (const file of newTicketFiles) {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('entityType', 'support_ticket_message')
            formData.append('entityId', data.ticket.firstMessageId.toString())

            const uploadRes = await fetch('/api/files/upload', {
              method: 'POST',
              body: formData,
            })

            if (!uploadRes.ok) {
              const uploadErr = await uploadRes.json().catch(() => ({}))
              console.error('Ошибка загрузки файла:', uploadErr)
              // Продолжаем загрузку остальных файлов
            }
          }
        } catch (uploadError) {
          console.error('Ошибка загрузки файлов:', uploadError)
        } finally {
          setUploadingNewTicketFiles(false)
        }
      }

      setSuccess('Мы получили обращение и свяжемся с вами в ближайшее время.')
      setSubject('')
      setMessage('')
      setNewTicketFiles([])
      await loadTickets() // Обновляем список тикетов
    } catch (err: any) {
      setError(err.message || 'Ошибка отправки')
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = async (ticketId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)
    
    // Проверка размера файлов (10 МБ)
    const maxSize = 10 * 1024 * 1024 // 10 МБ
    for (const file of fileArray) {
      if (file.size > maxSize) {
        setError(`Файл "${file.name}" превышает лимит 10 МБ`)
        return
      }
    }

    setAttachedFiles(prev => ({
      ...prev,
      [ticketId]: [...(prev[ticketId] || []), ...fileArray],
    }))

    // Очищаем input
    if (e.target) {
      e.target.value = ''
    }
  }

  const removeFile = (ticketId: number, index: number) => {
    setAttachedFiles(prev => {
      const files = prev[ticketId] || []
      return {
        ...prev,
        [ticketId]: files.filter((_, i) => i !== index),
      }
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' Б'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ'
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ'
  }

  const handleReply = async (ticketId: number) => {
    const message = replyMessage[ticketId]?.trim()
    const files = attachedFiles[ticketId] || []
    
    if (!message && files.length === 0) return

    try {
      setReplying(prev => ({ ...prev, [ticketId]: true }))
      
      // Сначала создаем сообщение
      const res = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message || '' }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Не удалось отправить ответ')
      }

      const data = await res.json()
      const messageId = data.message?.id

      // Если есть файлы и сообщение создано, загружаем их
      if (files.length > 0 && messageId) {
        setUploadingFiles(prev => ({ ...prev, [ticketId]: true }))
        try {
          for (const file of files) {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('entityType', 'support_ticket_message')
            formData.append('entityId', messageId.toString())

            const uploadRes = await fetch('/api/files/upload', {
              method: 'POST',
              body: formData,
            })

            if (!uploadRes.ok) {
              const uploadErr = await uploadRes.json().catch(() => ({}))
              console.error('Ошибка загрузки файла:', uploadErr)
              // Продолжаем загрузку остальных файлов
            }
          }
        } catch (uploadError) {
          console.error('Ошибка загрузки файлов:', uploadError)
        } finally {
          setUploadingFiles(prev => ({ ...prev, [ticketId]: false }))
        }
      }

      setReplyMessage(prev => ({ ...prev, [ticketId]: '' }))
      setAttachedFiles(prev => ({ ...prev, [ticketId]: [] }))
      await loadTickets()
    } catch (e: any) {
      setError(e?.message || 'Ошибка отправки ответа')
    } finally {
      setReplying(prev => ({ ...prev, [ticketId]: false }))
    }
  }

  const toggleTicket = async (ticket: SupportTicket) => {
    const isExpanded = expandedTickets.has(ticket.id)
    
    if (!isExpanded) {
      // При открытии тикета загружаем полные данные и отмечаем как прочитанные
      try {
        const res = await fetch(`/api/support/tickets/${ticket.id}`)
        if (res.ok) {
          const data = await res.json()
          // Обновляем тикет в списке
          setTickets(prev => prev.map(t => t.id === ticket.id ? data.ticket : t))
        }
      } catch (error) {
        console.error('Error loading ticket details:', error)
      }
    }
    
    setExpandedTickets(prev => {
      const newSet = new Set(prev)
      if (isExpanded) {
        newSet.delete(ticket.id)
      } else {
        newSet.add(ticket.id)
      }
      return newSet
    })
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return 'Открыт'
      case 'in_progress':
        return 'В работе'
      case 'resolved':
        return 'Решен'
      case 'closed':
        return 'Закрыт'
      default:
        return status
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="glass-panel rounded-3xl p-6 space-y-3">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Поддержка</p>
        <h1 className="text-3xl font-semibold text-[var(--foreground)]">Свяжитесь с нами</h1>
        <p className="text-sm text-[var(--muted)]">
          Опишите проблему или вопрос. Мы ответим на email и в Telegram (если указан в аккаунте).
          Тикет создастся в системе, SLA: быстрый ответ в рабочее время.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="p-3 rounded-2xl bg-[var(--background-soft)]">
            <p className="font-semibold text-[var(--foreground)]">Каналы</p>
            <p className="text-[var(--muted)]">Email + Telegram уведомления</p>
          </div>
          <div className="p-3 rounded-2xl bg-[var(--background-soft)]">
            <p className="font-semibold text-[var(--foreground)]">SLA</p>
            <p className="text-[var(--muted)]">Ответ в часы работы, критичное — сразу</p>
          </div>
          <div className="p-3 rounded-2xl bg-[var(--background-soft)]">
            <p className="font-semibold text-[var(--foreground)]">Без ограничений</p>
            <p className="text-[var(--muted)]">Поддержка включена во все планы</p>
          </div>
        </div>
      </div>

      {/* Список тикетов */}
      {tickets.length > 0 && (
        <div className="glass-panel rounded-3xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Мои тикеты</h2>
          <div className="space-y-3">
            {tickets.map((ticket) => {
              const isExpanded = expandedTickets.has(ticket.id)
              const unreadCount = ticket.unreadMessagesCount || 0
              
              return (
                <div
                  key={ticket.id}
                  className="rounded-xl border border-[var(--border)] bg-white overflow-hidden transition-all"
                >
                  {/* Заголовок тикета */}
                  <div
                    onClick={() => toggleTicket(ticket)}
                    className="p-4 cursor-pointer hover:bg-[var(--background-soft)] transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-[var(--muted)]">{ticket.ticketId}</span>
                          <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                            {getStatusLabel(ticket.status)}
                          </span>
                          {unreadCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-red-500 text-white font-medium">
                              {unreadCount} новое
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-[var(--foreground)]">{ticket.subject}</h3>
                        <p className="text-sm text-[var(--muted)] mt-1 line-clamp-2">{ticket.message}</p>
                      </div>
                      <div className="text-xs text-[var(--muted)] ml-4">
                        {new Date(ticket.createdAt).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                    <div className="text-xs text-[var(--muted)] mt-2 flex items-center justify-between">
                      <span>Сообщений: {ticket.messages.length}</span>
                      <span className="text-[var(--primary)]">
                        {isExpanded ? 'Свернуть' : 'Развернуть'}
                      </span>
                    </div>
                  </div>

                  {/* Раскрывающееся содержимое */}
                  {isExpanded && (
                    <div className="border-t border-[var(--border)] p-4 space-y-4 bg-[var(--background-soft)]">
                      {/* Переписка */}
                      <div className="space-y-3">
                        <h3 className="font-semibold text-[var(--foreground)]">Переписка</h3>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto">
                          {ticket.messages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`p-3 rounded-lg ${
                                msg.isFromAdmin
                                  ? 'bg-[var(--primary-soft)] border border-[var(--primary)]'
                                  : 'bg-white border border-[var(--border)]'
                              } ${!msg.isRead && msg.isFromAdmin ? 'ring-2 ring-red-300' : ''}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-medium">
                                  {msg.isFromAdmin ? 'Поддержка' : msg.fromName || msg.fromEmail}
                                  {!msg.isRead && msg.isFromAdmin && (
                                    <span className="ml-2 text-xs text-red-600">● Новое</span>
                                  )}
                                </div>
                                <div className="text-xs text-[var(--muted)]">
                                  {new Date(msg.createdAt).toLocaleString('ru-RU')}
                                </div>
                              </div>
                              <div className="text-sm whitespace-pre-wrap">{msg.message}</div>
                              {/* Прикрепленные файлы */}
                              {msg.files && msg.files.length > 0 && (
                                <div className="mt-3 space-y-2">
                                  {msg.files.map((file) => (
                                    <div
                                      key={file.id}
                                      className="flex items-center gap-2 p-2 bg-white rounded-lg border border-[var(--border)]"
                                    >
                                      {file.mimeType.startsWith('image/') ? (
                                        <img
                                          src={file.url}
                                          alt={file.originalName}
                                          className="w-12 h-12 object-cover rounded"
                                          onClick={() => window.open(file.url, '_blank')}
                                          style={{ cursor: 'pointer' }}
                                        />
                                      ) : (
                                        <div className="w-12 h-12 bg-[var(--background-soft)] rounded flex items-center justify-center text-xs">
                                          📎
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <a
                                          href={file.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-sm text-[var(--primary)] hover:underline truncate block"
                                        >
                                          {file.originalName}
                                        </a>
                                        <div className="text-xs text-[var(--muted)]">
                                          {formatFileSize(file.size)}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Форма ответа */}
                      <div className="space-y-3 pt-4 border-t border-[var(--border)]">
                        <h3 className="font-semibold text-[var(--foreground)]">Ответить</h3>
                        <textarea
                          value={replyMessage[ticket.id] || ''}
                          onChange={(e) => setReplyMessage(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                          placeholder="Введите ответ..."
                          rows={4}
                          className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                        />
                        
                        {/* Прикрепленные файлы */}
                        {attachedFiles[ticket.id] && attachedFiles[ticket.id].length > 0 && (
                          <div className="space-y-2">
                            {attachedFiles[ticket.id].map((file, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between p-2 bg-[var(--background-soft)] rounded-lg"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="text-sm">📎</span>
                                  <span className="text-sm text-[var(--foreground)] truncate">{file.name}</span>
                                  <span className="text-xs text-[var(--muted)]">
                                    ({formatFileSize(file.size)})
                                  </span>
                                </div>
                                <button
                                  onClick={() => removeFile(ticket.id, index)}
                                  className="text-red-500 hover:text-red-700 text-sm px-2"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-3">
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              multiple
                              onChange={(e) => handleFileSelect(ticket.id, e)}
                              className="hidden"
                              accept="image/*,.pdf,.doc,.docx,.txt"
                            />
                            <span className="px-4 py-2 rounded-xl border border-[var(--border)] bg-white text-sm text-[var(--foreground)] hover:bg-[var(--background-soft)] transition-colors inline-block">
                              📎 Прикрепить файл (до 10 МБ)
                            </span>
                          </label>
                          <button
                            onClick={() => handleReply(ticket.id)}
                            disabled={(!replyMessage[ticket.id]?.trim() && (!attachedFiles[ticket.id] || attachedFiles[ticket.id].length === 0)) || replying[ticket.id] || uploadingFiles[ticket.id]}
                            className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white font-medium text-sm hover:opacity-90 disabled:opacity-50"
                          >
                            {replying[ticket.id] || uploadingFiles[ticket.id] ? 'Отправка...' : 'Отправить ответ'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Форма создания нового тикета */}
      <div className="glass-panel rounded-3xl p-6 space-y-4">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">Создать тикет</h2>
        {error && (
          <div className="rounded-xl border border-[var(--error)]/30 bg-[var(--error-soft)] px-4 py-3 text-[var(--error)]">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-[var(--success)]/30 bg-[var(--success-soft)] px-4 py-3 text-[var(--success)]">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--foreground)]">Тема</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                minLength={3}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                placeholder="Например: Не приходят письма"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--foreground)]">Email для ответа</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--foreground)]">Описание</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              minLength={10}
              rows={6}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
              placeholder="Опишите, что случилось, шаги воспроизведения и ожидаемый результат"
            />
          </div>

          {/* Прикрепленные файлы для нового тикета */}
          {newTicketFiles.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--foreground)]">Прикрепленные файлы</label>
              <div className="space-y-2">
                {newTicketFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-[var(--background-soft)] rounded-lg"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm">📎</span>
                      <span className="text-sm text-[var(--foreground)] truncate">{file.name}</span>
                      <span className="text-xs text-[var(--muted)]">
                        ({formatFileSize(file.size)})
                      </span>
                    </div>
                    <button
                      onClick={() => removeNewTicketFile(index)}
                      className="text-red-500 hover:text-red-700 text-sm px-2"
                      type="button"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                onChange={handleNewTicketFileSelect}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
              <span className="px-4 py-2 rounded-xl border border-[var(--border)] bg-white text-sm text-[var(--foreground)] hover:bg-[var(--background-soft)] transition-colors inline-block">
                📎 Прикрепить файл (до 10 МБ)
              </span>
            </label>
            <button
              type="submit"
              disabled={loading || uploadingNewTicketFiles}
              className="rounded-2xl px-5 py-2.5 bg-[var(--primary)] text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-60"
            >
              {loading || uploadingNewTicketFiles ? 'Отправляем...' : 'Отправить тикет'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

