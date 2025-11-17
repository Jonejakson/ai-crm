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
    // Показываем "Компания" только для админов
    ...(isAdmin ? [{ id: 'company', name: 'Компания', href: '/company', icon: '🏢' }] : []),
  ]


  return (
    <div className="hidden md:flex w-72 h-screen bg-gradient-to-b from-[#0b1730] via-[#0f1c3f] to-[#101623] text-white px-5 py-7 border-r border-white/10 shadow-2xl">
      <div className="flex flex-1 flex-col">
        {/* Логотип */}
        <div className="space-y-2 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs uppercase tracking-[0.2em]">
            <span className="text-[var(--secondary)]">Pulse</span>
            <span className="text-white/70">CRM</span>
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
                className={`group flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 border border-transparent ${
                  isActive
                    ? 'bg-white/15 border-white/20 shadow-lg shadow-blue-600/30'
                    : 'hover:bg-white/5 hover:border-white/10'
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
                  <span className="ml-auto w-2 h-2 rounded-full bg-[var(--secondary)] shadow-[0_0_12px_rgba(0,198,174,0.8)]" />
                )}
              </a>
            )
          })}
        </nav>

        {/* Пользователь */}
        <div className="mt-auto rounded-3xl border border-white/15 bg-white/5 px-4 py-5 text-sm shadow-xl backdrop-blur-2xl">
          <p className="text-white/60 text-xs uppercase tracking-[0.4em] mb-2">
            Профиль
          </p>
          <p className="text-base font-semibold">{userName}</p>
          <p className="text-white/60 text-xs">{userEmail}</p>
          {isAdmin && (
            <span className="mt-3 inline-flex items-center text-[10px] uppercase tracking-[0.35em] text-green-200 bg-white/10 px-3 py-1 rounded-full">
              Admin
            </span>
          )}
        </div>
      </div>
    </div>
  )
}