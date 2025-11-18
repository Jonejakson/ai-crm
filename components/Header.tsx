'use client'

import { useSession, signOut } from 'next-auth/react'
import Notifications from './Notifications'
import SearchBar from './SearchBar'

export default function Header() {
  const { data: session } = useSession()
  const currentDate = new Date().toLocaleDateString('ru-RU', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/80 backdrop-blur-xl shadow-sm">
      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)] font-semibold">Панель управления</p>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">
            {session?.user ? `Добро пожаловать, ${session.user.name}` : 'Добро пожаловать в Pulse CRM'}
          </h1>
          <p className="text-sm text-[var(--muted)]">{currentDate}</p>
        </div>
          <div className="hidden w-full max-w-xl lg:block">
            <SearchBar />
          </div>
          {session?.user ? (
            <div className="flex items-center gap-4">
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