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
      <div className="flex h-screen bg-[var(--background)]">
        <Sidebar currentContactId={currentContactId} />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header />
          <div className="px-6 py-4 bg-transparent border-b border-white/40 backdrop-blur-xl">
            <SearchBar />
          </div>
          <main className="flex-1 overflow-y-auto px-6 py-8 bg-transparent">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  )
}