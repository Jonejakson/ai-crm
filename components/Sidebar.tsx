'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { getActiveSection } from '@/lib/utils'

interface SidebarProps {
  currentContactId?: number;
}

export default function Sidebar({ currentContactId }: SidebarProps) {
  const { data: session } = useSession()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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

  const SidebarContent = () => (
    <>
      <div className="flex flex-1 flex-col">
        {/* Логотип */}
        <div className="space-y-3 pb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center">
              <span className="text-white text-sm font-bold">P</span>
            </div>
            <span className="text-lg font-semibold text-white">Pulse CRM</span>
          </div>
          {currentContactId && (
            <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70">
              Просмотр клиента #{currentContactId}
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
                onClick={() => setIsMobileMenuOpen(false)}
                className={`group flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-[var(--primary-soft)] text-[var(--primary)] font-medium'
                    : 'text-[var(--muted)] hover:bg-[var(--background-soft)] hover:text-[var(--foreground)]'
                }`}
              >
                <span className="text-lg">
                  {item.icon}
                </span>
                <span className="text-sm">
                  {item.name}
                </span>
              </a>
            )
          })}
        </nav>

        {/* Пользователь */}
        <div className="mt-auto pt-4 border-t border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--primary-soft)] flex items-center justify-center text-[var(--primary)] text-sm font-semibold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)] truncate">{userName}</p>
              <p className="text-xs text-[var(--muted)] truncate">{userEmail}</p>
            </div>
          </div>
          {isAdmin && (
            <span className="mt-2 inline-flex items-center text-xs text-[var(--success)] bg-[var(--success-soft)] px-2 py-1 rounded">
              Admin
            </span>
          )}
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Десктопный сайдбар */}
      <div className="hidden md:flex w-64 h-screen bg-[var(--surface)] text-[var(--foreground)] px-4 py-6 border-r border-[var(--border)]">
        <SidebarContent />
      </div>

      {/* Мобильное меню кнопка */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] shadow-md"
        aria-label="Открыть меню"
      >
        {isMobileMenuOpen ? '✕' : '☰'}
      </button>

      {/* Мобильный сайдбар */}
      {isMobileMenuOpen && (
        <>
          <div 
            className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="md:hidden fixed left-0 top-0 h-full w-64 bg-[var(--surface)] text-[var(--foreground)] px-4 py-6 border-r border-[var(--border)] shadow-xl z-50">
            <SidebarContent />
          </div>
        </>
      )}
    </>
  )
}