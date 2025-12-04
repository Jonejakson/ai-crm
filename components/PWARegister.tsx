'use client'

import { useEffect, useState } from 'react'

export default function PWARegister() {
  const [isInstalled, setIsInstalled] = useState(false)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    // Проверка, установлено ли приложение
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    // Регистрация Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js', {
          scope: '/',
        })
        .then((registration) => {
          console.log('[PWA] Service Worker registered:', registration.scope)

          // Проверка обновлений каждые 60 секунд
          setInterval(() => {
            registration.update()
          }, 60000)

          // Обработка обновлений
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Новый Service Worker доступен
                  console.log('[PWA] New Service Worker available')
                  // Можно показать уведомление пользователю
                }
              })
            }
          })
        })
        .catch((error) => {
          console.error('[PWA] Service Worker registration failed:', error)
        })

      // Обработка обновления Service Worker
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] Service Worker controller changed')
        // Перезагружаем страницу для применения обновлений
        window.location.reload()
      })
    }

    // Обработка события установки PWA
    const handleBeforeInstallPrompt = (e: Event) => {
      // Предотвращаем автоматическое отображение подсказки
      e.preventDefault()
      // Сохраняем событие для последующего использования
      setDeferredPrompt(e)
      // Показываем кнопку установки
      setShowInstallPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Проверка, было ли приложение установлено
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed')
      setIsInstalled(true)
      setShowInstallPrompt(false)
      setDeferredPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return
    }

    // Показываем подсказку установки
    deferredPrompt.prompt()

    // Ждем ответа пользователя
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      console.log('[PWA] User accepted the install prompt')
    } else {
      console.log('[PWA] User dismissed the install prompt')
    }

    // Очищаем сохраненное событие
    setDeferredPrompt(null)
    setShowInstallPrompt(false)
  }

  // Не показываем кнопку установки, если приложение уже установлено
  if (isInstalled || !showInstallPrompt) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              Установить Pocket CRM
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              Установите приложение для быстрого доступа и работы офлайн
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleInstallClick}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all"
              >
                Установить
              </button>
              <button
                onClick={() => setShowInstallPrompt(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
              >
                Позже
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

