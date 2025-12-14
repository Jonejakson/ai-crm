'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Skeleton from '@/components/Skeleton'

interface Dialog {
  id: number
  message: string
  sender: string
  platform: string
  createdAt: string
  contact?: {
    id: number
    name: string
    email: string | null
  }
}

export default function DialogsPage() {
  const [dialogs, setDialogs] = useState<Dialog[]>([])
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()
  const contactId = searchParams.get('contactId')

  useEffect(() => {
    fetchDialogs()
  }, [contactId])

  const fetchDialogs = async () => {
    try {
      setLoading(true)
      const url = contactId 
        ? `/api/dialogs?contactId=${contactId}`
        : '/api/dialogs'
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch dialogs')
      }
      
      const data = await response.json()
      setDialogs(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching dialogs:', error)
      setDialogs([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="text" width="40%" height={32} />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-panel rounded-2xl p-6">
              <Skeleton variant="text" width="60%" height={16} className="mb-2" />
              <Skeleton variant="text" width="100%" height={14} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Диалоги</h1>
        <p className="text-[var(--muted)]">
          {contactId 
            ? 'История сообщений с клиентом'
            : 'Все диалоги с клиентами'
          }
        </p>
      </div>

      {dialogs.length === 0 ? (
        <div className="empty-state py-12">
          <div className="empty-state-icon flex items-center justify-center">
            <svg className="w-16 h-16 text-[var(--muted-soft)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="empty-state-title">Нет диалогов</h3>
          <p className="empty-state-description">
            Пока нет сообщений. Диалоги появятся здесь после начала общения с клиентами.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {dialogs.map((dialog) => (
            <div key={dialog.id} className="glass-panel rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  {dialog.contact && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--primary-soft)] to-[var(--primary)] flex items-center justify-center text-[var(--primary)] font-bold text-xs">
                        {dialog.contact.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {dialog.contact.name}
                        </p>
                        {dialog.contact.email && (
                          <p className="text-xs text-[var(--muted)]">{dialog.contact.email}</p>
                        )}
                      </div>
                    </div>
                  )}
                  <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">
                    {dialog.message}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs text-[var(--muted)]">
                  <span className="capitalize">{dialog.sender}</span>
                  <span>{new Date(dialog.createdAt).toLocaleString('ru-RU')}</span>
                </div>
              </div>
              {dialog.platform && dialog.platform !== 'INTERNAL' && (
                <div className="mt-2 pt-2 border-t border-[var(--border-soft)]">
                  <span className="text-xs text-[var(--muted)]">
                    Платформа: {dialog.platform}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

