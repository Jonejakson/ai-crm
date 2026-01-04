'use client'

import { useSession, signOut } from 'next-auth/react'
import { useTheme } from '@/lib/theme'
import { useState, useEffect } from 'react'
import Notifications from './Notifications'
import SearchBar from './SearchBar'
import { MoonIcon, SunIcon, DialogsIcon } from './Icons'

export default function Header() {
  const { data: session } = useSession()
  const { theme, toggleTheme } = useTheme()
  const [unreadSupportCount, setUnreadSupportCount] = useState(0)
  const currentDate = new Date().toLocaleDateString('ru-RU', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })

  // Загружаем количество непрочитанных сообщений в тикетах
  useEffect(() => {
    if (session?.user) {
      const loadUnreadCount = async () => {
        try {
          const res = await fetch('/api/support/unread-count')
          if (res.ok) {
            const data = await res.json()
            setUnreadSupportCount(data.count || 0)
          }
        } catch (error) {
          console.error('Error loading unread support count:', error)
        }
      }
      
      loadUnreadCount()
      const interval = setInterval(loadUnreadCount, 30000) // Обновляем каждые 30 секунд
      return () => clearInterval(interval)
    }
  }, [session])

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)] backdrop-blur-xl bg-opacity-95 shadow-sm">
      <div className="flex flex-col gap-4 px-4 py-5 md:px-6 md:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--foreground)] bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] bg-clip-text text-transparent">
            {session?.user ? session.user.name : 'Flame CRM'}
          </h1>
          <p className="text-xs text-[var(--muted)] mt-1">
            {new Date().toLocaleDateString('ru-RU', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
          <div className="hidden w-full max-w-xl lg:block">
            <SearchBar />
          </div>
          {session?.user ? (
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-xl text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-soft)] transition-all duration-300 hover:scale-110"
                title={theme === 'light' ? 'Переключить на темную тему' : 'Переключить на светлую тему'}
              >
                {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
              </button>
              <a
                href="/support"
                className="relative p-2.5 rounded-xl text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-soft)] transition-all duration-300 hover:scale-110"
                title="Поддержка"
              >
                <DialogsIcon className="w-5 h-5" />
                {unreadSupportCount > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                    {unreadSupportCount > 9 ? '9+' : unreadSupportCount}
                  </span>
                )}
              </a>
              <Notifications />
              <div className="hidden text-right sm:block px-3 py-2 rounded-xl bg-[var(--background-soft)]">
                <p className="text-sm font-semibold text-[var(--foreground)]">{session.user.name}</p>
                <p className="text-xs text-[var(--muted)]">{session.user.email}</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: window.location.origin + '/login' })}
                className="btn-ghost text-sm px-4"
              >
                Выйти
              </button>
            </div>
          ) : (
            <div className="text-sm text-[var(--muted)] px-4 py-2 rounded-xl bg-[var(--background-soft)]">
              Войдите, чтобы увидеть персонализированные данные
            </div>
          )}
        </div>
        <div className="lg:hidden">
          <SearchBar />
        </div>
      </div>
    </header>
  )
}