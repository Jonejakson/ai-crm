'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { getActiveSection } from '@/lib/utils'
import {
  DashboardIcon,
  DealsIcon,
  ContactsIcon,
  TasksIcon,
  CalendarIcon,
  AnalyticsIcon,
  ActivityIcon,
  AutomationsIcon,
  CompanyIcon,
  EmailTemplateIcon,
  MenuIcon,
  CloseIcon
} from './Icons'
import Logo from './Logo'

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
    { id: 'dashboard', name: 'Дашборд', href: '/', Icon: DashboardIcon },
    { id: 'deals', name: 'Сделки', href: '/deals', Icon: DealsIcon },
    { id: 'contacts', name: 'Клиенты', href: '/contacts', Icon: ContactsIcon },
    { id: 'tasks', name: 'Задачи', href: '/tasks', Icon: TasksIcon },
    { id: 'calendar', name: 'Календарь', href: '/calendar', Icon: CalendarIcon },
    { id: 'analytics', name: 'Аналитика', href: '/analytics', Icon: AnalyticsIcon },
    { id: 'activity', name: 'Активность', href: '/activity', Icon: ActivityIcon },
    // Показываем админские разделы только для админов
    ...(isAdmin ? [
      { id: 'email-templates', name: 'Шаблоны писем', href: '/email-templates', Icon: EmailTemplateIcon },
      { id: 'automations', name: 'Автоматизации', href: '/automations', Icon: AutomationsIcon },
      { id: 'company', name: 'Компания', href: '/company', Icon: CompanyIcon }
    ] : []),
  ]

  const SidebarContent = () => (
    <>
      <div className="flex flex-col h-full">
        {/* Логотип */}
        <div className="space-y-3 pb-6 flex-shrink-0">
          <Logo variant="full" size="md" />
          {currentContactId && (
            <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70">
              Просмотр клиента #{currentContactId}
            </div>
          )}
        </div>

        {/* Навигация */}
        <nav className="sidebar-nav space-y-1.5 flex-1 overflow-y-auto pr-1 min-h-0">
          {menuItems.map((item) => {
            const isActive = activeSection === item.id
            return (
              <a
                key={item.id}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 relative ${
                  isActive
                    ? 'bg-gradient-to-r from-[var(--primary-soft)] to-[var(--primary-soft)] text-[var(--primary)] font-semibold shadow-sm'
                    : 'text-[var(--muted)] hover:bg-[var(--background-soft)] hover:text-[var(--foreground)] hover:translate-x-1'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--primary)] rounded-r-full" />
                )}
                <item.Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'text-[var(--primary)] scale-110' : 'text-[var(--muted)] group-hover:scale-110'}`} />
                <span className="text-sm font-medium">
                  {item.name}
                </span>
              </a>
            )
          })}
        </nav>

        {/* Пользователь */}
        <div className="mt-auto pt-4 border-t border-[var(--border)] flex-shrink-0">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--background-soft)] hover:bg-[var(--panel-muted)] transition-all duration-300">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-light)] flex items-center justify-center text-white text-sm font-bold shadow-md">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--foreground)] truncate">{userName}</p>
              <p className="text-xs text-[var(--muted)] truncate">{userEmail}</p>
            </div>
          </div>
          {isAdmin && (
            <span className="mt-2 inline-flex items-center text-xs font-semibold text-[var(--success)] bg-[var(--success-soft)] px-3 py-1.5 rounded-lg shadow-sm">
              ⭐ Admin
            </span>
          )}
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Десктопный сайдбар */}
      <div className="hidden md:flex w-64 sticky top-0 h-screen bg-[var(--surface)] text-[var(--foreground)] px-4 py-6 border-r border-[var(--border)] shadow-sm backdrop-blur-xl bg-opacity-95 overflow-y-auto">
        <SidebarContent />
      </div>

      {/* Мобильное меню кнопка */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden fixed top-4 right-4 z-50 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] shadow-lg hover:shadow-xl transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label={isMobileMenuOpen ? "Закрыть меню" : "Открыть меню"}
      >
        {isMobileMenuOpen ? <CloseIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
      </button>

      {/* Мобильный сайдбар */}
      {isMobileMenuOpen && (
        <>
          <div 
            className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 cursor-pointer"
            onClick={() => setIsMobileMenuOpen(false)}
            role="button"
            aria-label="Закрыть меню"
          />
          <div 
            className={`md:hidden fixed left-0 top-0 h-full w-72 bg-[var(--surface)] text-[var(--foreground)] px-4 py-6 border-r border-[var(--border)] shadow-xl z-50 transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent />
          </div>
        </>
      )}
    </>
  )
}