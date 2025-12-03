'use client'

import { useEffect, useState } from 'react'

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

interface NotificationToastProps {
  notification: Notification
  onClose: () => void
  onClick?: () => void
}

export default function NotificationToast({
  notification,
  onClose,
  onClick,
}: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300) // Ждем завершения анимации
    }, 5000) // Показываем 5 секунд

    return () => clearTimeout(timer)
  }, [onClose])

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <SuccessIcon className="w-6 h-6" />
      case 'warning':
        return <InfoIcon className="w-6 h-6" />
      case 'error':
        return <ErrorIcon className="w-6 h-6" />
      case 'info':
      default:
        return <InfoIcon className="w-6 h-6" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200'
      case 'error':
        return 'bg-red-50 border-red-200'
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200'
    }
  }

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-sm w-full transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
      }`}
    >
      <div
        className={`${getTypeColor(notification.type)} border rounded-lg shadow-lg p-4 cursor-pointer hover:shadow-xl transition-shadow`}
        onClick={onClick}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <span className="flex items-center">{getTypeIcon(notification.type)}</span>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-900 text-sm mb-1">
                {notification.title}
              </h4>
              <p className="text-sm text-gray-600 line-clamp-2">
                {notification.message}
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsVisible(false)
              setTimeout(onClose, 300)
            }}
            className="ml-2 text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}

