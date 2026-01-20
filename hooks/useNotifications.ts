'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Notification {
  id: number
  title: string
  message: string
  type: string
  entityType?: string
  entityId?: number
  isRead: boolean
  createdAt: string
}

interface UseNotificationsOptions {
  pollingInterval?: number // интервал опроса в миллисекундах
  showToasts?: boolean // показывать ли toast уведомления
  onNewNotification?: (notification: Notification) => void
  checkInterval?: number // интервал проверки генерации уведомлений на сервере
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const {
    pollingInterval = 10000, // 10 секунд по умолчанию
    showToasts = true,
    onNewNotification,
    checkInterval = 60000, // раз в минуту
  } = options

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [newNotifications, setNewNotifications] = useState<Notification[]>([])
  const lastFetchTime = useRef<Date | null>(null)
  const lastCheckTime = useRef<number>(0)
  const router = useRouter()

  const maybeCheckServerNotifications = useCallback(async () => {
    const now = Date.now()
    if (now - lastCheckTime.current < checkInterval) return
    lastCheckTime.current = now
    try {
      await fetch('/api/notifications/check', { method: 'POST' })
    } catch (error) {
      // не блокируем UI из-за фоновой проверки
      console.error('Error checking notifications:', error)
    }
  }, [checkInterval])

  const fetchNotifications = useCallback(async () => {
    try {
      await maybeCheckServerNotifications()
      const response = await fetch('/api/notifications?unreadOnly=false')
      if (response.ok) {
        const data = await response.json()
        
        // Определяем новые уведомления
        if (lastFetchTime.current && showToasts) {
          const newOnes = data.filter((n: Notification) => {
            const createdAt = new Date(n.createdAt)
            return createdAt > lastFetchTime.current! && !n.isRead
          })
          
          if (newOnes.length > 0) {
            setNewNotifications((prev) => [...newOnes, ...prev])
            newOnes.forEach((n: Notification) => {
              if (onNewNotification) {
                onNewNotification(n)
              }
            })
          }
        }
        
        setNotifications(data)
        setUnreadCount(data.filter((n: Notification) => !n.isRead).length)
        lastFetchTime.current = new Date()
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }, [showToasts, onNewNotification, maybeCheckServerNotifications])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, pollingInterval)
    return () => clearInterval(interval)
  }, [fetchNotifications, pollingInterval])

  const markAsRead = useCallback(async (id: number) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
        setNewNotifications((prev) => prev.filter((n) => n.id !== id))
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
      })
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
        setUnreadCount(0)
        setNewNotifications([])
      }
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }, [])

  const deleteNotification = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/notifications?id=${id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id))
        const deleted = notifications.find((n) => n.id === id)
        if (deleted && !deleted.isRead) {
          setUnreadCount((prev) => Math.max(0, prev - 1))
        }
        setNewNotifications((prev) => prev.filter((n) => n.id !== id))
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }, [notifications])

  const removeToast = useCallback((id: number) => {
    setNewNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      if (!notification.isRead) {
        markAsRead(notification.id)
      }

      if (notification.entityType && notification.entityId) {
        switch (notification.entityType) {
          case 'task':
            router.push(`/tasks`)
            break
          case 'deal':
            router.push(`/deals`)
            break
          case 'event':
            router.push(`/calendar`)
            break
          case 'contact':
            router.push(`/contacts/${notification.entityId}`)
            break
        }
      }
    },
    [markAsRead, router]
  )

  return {
    notifications,
    unreadCount,
    newNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    removeToast,
    handleNotificationClick,
    refresh: fetchNotifications,
  }
}

