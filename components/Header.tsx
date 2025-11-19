'use client'

import { useSession, signOut } from 'next-auth/react'
import { useTheme } from '@/lib/theme'
import Notifications from './Notifications'
import SearchBar from './SearchBar'

export default function Header() {
  const { data: session } = useSession()
  const { theme, toggleTheme } = useTheme()
  const currentDate = new Date().toLocaleDateString('ru-RU', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-xl shadow-sm">
      <div className="flex flex-col gap-4 px-4 py-4 md:px-6 md:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-[var(--foreground)]">
            {session?.user ? session.user.name : 'Pulse CRM'}
          </h1>
        </div>
          <div className="hidden w-full max-w-xl lg:block">
            <SearchBar />
          </div>
          {session?.user ? (
            <div className="flex items-center gap-4">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-soft)] transition-colors"
                title={theme === 'light' ? 'Переключить на темную тему' : 'Переключить на светлую тему'}
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
              <Notifications />
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-[var(--foreground)]">{session.user.name}</p>
                <p className="text-xs text-[var(--muted)]">{session.user.email}</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="btn-ghost text-sm"
              >
                Выйти
              </button>
            </div>
          ) : (
            <div className="text-sm text-slate-500">
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