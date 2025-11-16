'use client'

import './globals.css'
import { SessionProvider } from 'next-auth/react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import SearchBar from '@/components/SearchBar'
import { usePathname } from 'next/navigation'

// Функция для извлечения ID контакта из пути
function getCurrentContactId(pathname: string): number | undefined {
  const match = pathname.match(/^\/contacts\/(\d+)/)
  return match ? parseInt(match[1], 10) : undefined
}

export default function LayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const currentContactId = getCurrentContactId(pathname)

  return (
    <SessionProvider>
      <div className="flex h-screen bg-gray-50">
        <Sidebar currentContactId={currentContactId} />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header />
          <div className="border-b bg-white px-4 sm:px-6 py-4">
            <SearchBar />
          </div>
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  )
}