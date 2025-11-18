'use client'

import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { getActiveSection } from '@/lib/utils'

interface SidebarProps {
  currentContactId?: number;
}

export default function Sidebar({ currentContactId }: SidebarProps) {
  const { data: session } = useSession()

  const pathname = usePathname()
  const activeSection = getActiveSection(pathname)
  const isAdmin = session?.user?.role === 'admin'
  const userName = session?.user?.name || 'Пользователь'
  const userEmail = session?.user?.email || 'email@company.com'

  const menuItems = [
    { id: 'dashboard', name: 'Дашборд', href: '/', icon: '📊' },
    { id: 'deals', name: 'Сделки', href: '/deals', icon: '💰' },
    { id: 'contacts', name: 'Клиенты', href: '/contacts', icon: '👥' },
    { id: 'tasks', name: 'Задачи', href: '/tasks', icon: '✅' },
    { id: 'calendar', name: 'Календарь', href: '/calendar', icon: '📅' },
    { id: 'analytics', name: 'Аналитика', href: '/analytics', icon: '📈' },
    { id: 'dialogs', name: 'Диалоги', href: '/dialogs', icon: '💬' },
    { id: 'activity', name: 'Активность', href: '/activity', icon: '🕒' },
    // Показываем админские разделы только для админов
    ...(isAdmin ? [
      { id: 'automations', name: 'Автоматизации', href: '/automations', icon: '⚙️' },
      { id: 'company', name: 'Компания', href: '/company', icon: '🏢' }
    ] : []),
  ]


  return (
    <div className="hidden md:flex w-72 h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-8 border-r border-slate-700/50 shadow-2xl">
      <div className="flex flex-1 flex-col">
        {/* Логотип */}
        <div className="space-y-2 pb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-xs font-bold uppercase tracking-[0.15em] shadow-lg">
            <span className="text-white">Pulse</span>
            <span className="text-white/90">CRM</span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-1">
              Управление воронкой
            </p>
            <h1 className="text-2xl font-semibold">
              Умная CRM
            </h1>
          </div>
          {currentContactId && (
            <div className="mt-3 px-4 py-2 rounded-2xl bg-white/10 border border-white/10 text-sm text-white/80">
              👁️ Просмотр клиента #{currentContactId}
            </div>
          )}
        </div>

        {/* Навигация */}
        <nav className="sidebar-nav space-y-1 flex-1 overflow-y-auto pr-1">
          {menuItems.map((item) => {
            const isActive = activeSection === item.id
            return (
              <a
                key={item.id}
                href={item.href}
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 shadow-lg shadow-indigo-500/20 text-white'
                    : 'hover:bg-white/5 hover:border-white/10 border border-transparent text-white/70 hover:text-white'
                }`}
              >
                <span
                  className={`text-xl ${
                    isActive ? 'scale-110' : 'text-white/70'
                  }`}
                >
                  {item.icon}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium tracking-wide">
                    {item.name}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.25em] text-white/40">
                    {isActive ? 'Активно' : 'Раздел'}
                  </span>
                </div>
                {isActive && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-gradient-to-r from-indigo-400 to-purple-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                )}
              </a>
            )
          })}
        </nav>

        {/* Пользователь */}
        <div className="mt-auto rounded-2xl border border-slate-700/50 bg-slate-800/50 px-5 py-4 text-sm shadow-xl backdrop-blur-xl">
          <p className="text-white/50 text-xs uppercase tracking-[0.3em] mb-2 font-semibold">
            Профиль
          </p>
          <p className="text-base font-semibold text-white mb-1">{userName}</p>
          <p className="text-white/60 text-xs mb-3">{userEmail}</p>
          {isAdmin && (
            <span className="inline-flex items-center text-[10px] uppercase tracking-[0.25em] text-emerald-300 bg-emerald-500/20 px-3 py-1.5 rounded-lg font-bold border border-emerald-500/30">
              Admin
            </span>
          )}
        </div>
      </div>
    </div>
  )
}