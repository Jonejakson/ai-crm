'use client'

import { useEffect, useMemo, useState } from 'react'
import { useNotifications } from '@/hooks/useNotifications'
import NotificationToast from './NotificationToast'
import { BellIcon, SuccessIcon, ErrorIcon, InfoIcon } from './Icons'

export default function Notifications() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'Notification' in window
    setPushSupported(supported)
    if (supported) {
      setPushPermission(Notification.permission)
    }
  }, [])

  const maybeShowBrowserNotification = (notification: any) => {
    if (!pushSupported) return
    if (pushPermission !== 'granted') return
    // Если вкладка активна — достаточно toast'а
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') return

    try {
      new Notification(notification.title || 'Уведомление', {
        body: notification.message,
      })
    } catch {
      // ignore
    }
  }
  
  const {
    notifications,
    unreadCount,
    newNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    removeToast,
    handleNotificationClick,
  } = useNotifications({
    pollingInterval: 10000, // 10 секунд
    showToasts: true,
    checkInterval: 60000, // раз в минуту создаём overdue/upcoming на сервере
    onNewNotification: (n) => maybeShowBrowserNotification(n),
  })

  const handleMarkAllAsRead = async () => {
    setLoading(true)
    await markAllAsRead()
    setLoading(false)
  }

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      info: 'ℹ️',
      warning: '⚠️',
      success: '✅',
      error: '❌',
    }
    return icons[type] || 'ℹ️'
  }

  // Toast уведомления для новых уведомлений
  const activeToasts = newNotifications.slice(0, 3) // Максимум 3 toast одновременно

  const showEnablePush = useMemo(() => pushSupported && pushPermission !== 'granted', [pushSupported, pushPermission])

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-soft)] rounded-lg transition-colors"
        >
          <BellIcon className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">
                Уведомления {unreadCount > 0 && `(${unreadCount})`}
              </h3>
              <div className="flex items-center gap-3">
                {showEnablePush && (
                  <button
                    onClick={async () => {
                      try {
                        const permission = await Notification.requestPermission()
                        setPushPermission(permission)
                      } catch {
                        // ignore
                      }
                    }}
                    className="text-sm text-[var(--primary)] hover:underline"
                  >
                    Включить push
                  </button>
                )}
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    disabled={loading}
                    className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  >
                    Отметить все как прочитанные
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  Нет уведомлений
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => {
                        handleNotificationClick(notification)
                        setIsOpen(false)
                      }}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                        !notification.isRead ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-lg flex items-center">{getTypeIcon(notification.type)}</span>
                            <h4 className={`font-medium ${!notification.isRead ? 'font-semibold' : ''}`}>
                              {notification.title}
                            </h4>
                            {!notification.isRead && (
                              <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(notification.createdAt).toLocaleString('ru-RU', {
                              day: 'numeric',
                              month: 'long',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteNotification(notification.id)
                          }}
                          className="ml-2 text-gray-400 hover:text-red-600 text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toast уведомления */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {activeToasts.map((notification) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onClose={() => removeToast(notification.id)}
            onClick={() => {
              handleNotificationClick(notification)
              removeToast(notification.id)
            }}
          />
        ))}
      </div>
    </>
  )
}
