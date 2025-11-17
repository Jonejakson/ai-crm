'use client'

import { useSession, signOut } from 'next-auth/react'
import Notifications from './Notifications'

export default function Header() {
  const { data: session } = useSession()
  const currentDate = new Date().toLocaleDateString('ru-RU', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })

  return (
    <header className="sticky top-0 z-40 border-b border-white/40 bg-white/70 backdrop-blur-2xl shadow-[0_10px_35px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Панель управления</p>
          <h1 className="text-2xl font-semibold text-slate-900">
            {session?.user ? `Добро пожаловать, ${session.user.name}` : 'Добро пожаловать в Pulse CRM'}
          </h1>
          <p className="text-sm text-slate-500">{currentDate}</p>
        </div>
        
        {session?.user && (
          <div className="flex items-center gap-4">
            <Notifications />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-900">{session.user.name}</p>
              <p className="text-xs text-slate-500">{session.user.email}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="btn-secondary text-sm"
            >
              Выйти
            </button>
          </div>
        )}
        {!session?.user && (
          <div className="text-sm text-slate-500">
            Войдите, чтобы увидеть персонализированные данные
          </div>
        </div>
      </div>
    </header>
  )
}