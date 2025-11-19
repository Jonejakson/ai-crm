'use client'

import './globals.css'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/lib/theme'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
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
      <ThemeProvider>
        <div className="flex h-screen bg-[var(--background)]">
          <Sidebar currentContactId={currentContactId} />
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <Header />
            <main className="flex-1 overflow-y-auto px-4 py-6 md:px-6 md:py-8 bg-transparent">
              {children}
            </main>
          </div>
        </div>
      </ThemeProvider>
    </SessionProvider>
  )
}