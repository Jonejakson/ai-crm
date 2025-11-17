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
  
  const pathname = usePathname()
  const activeSection = getActiveSection(pathname)
  const isAdmin = session?.user?.role === 'admin'

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
    <>
      {/* Сайдбар */}
      <div className="hidden md:flex w-64 bg-gradient-to-b from-gray-900 to-gray-800 text-white min-h-screen p-4 flex-col shadow-xl border-r border-gray-700">
        {/* Логотип */}
        <div className="mb-8 p-4 animate-fadeIn">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            CRM System
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {currentContactId ? 'Режим клиента' : 'Управление клиентами'}
          </p>
        </div>

        {/* Навигация */}
        <nav className="space-y-1.5 flex-1">
          {menuItems.map((item, index) => {
            const isActive = activeSection === item.id
            return (
              <a
                key={item.id}
                href={item.href}
                className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30' 
                    : 'hover:bg-gray-800/50 hover:translate-x-1'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="font-medium">{item.name}</span>
                {isActive && (
                  <span className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse-slow"></span>
                )}
              </a>
            )
          })}
        </nav>

        {/* Информация о текущем клиенте */}
        {currentContactId && (
          <div className="mt-4 p-3 bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-300">
              👁️ Режим просмотра клиента
            </p>
          </div>
        )}
      </div>
    </>
  )
}