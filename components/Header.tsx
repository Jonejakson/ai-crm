'use client'

import { useSession, signOut } from 'next-auth/react'
import Notifications from './Notifications'

export default function Header() {
  const { data: session } = useSession()

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40 backdrop-blur-sm bg-white/95">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="animate-fadeIn">
          <h1 className="text-xl font-bold text-gray-900 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Панель управления
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {session?.user ? `Добро пожаловать, ${session.user.name}` : 'Добро пожаловать в вашу CRM'}
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="hidden md:block text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
            {new Date().toLocaleDateString('ru-RU', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
          
          {session?.user && (
            <>
              <Notifications />
              <div className="flex items-center space-x-3">
                <div className="hidden sm:block text-right">
                  <div className="text-sm font-semibold text-gray-900">{session.user.name}</div>
                  <div className="text-xs text-gray-500">{session.user.email}</div>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 font-medium active:scale-95"
                >
                  Выйти
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}