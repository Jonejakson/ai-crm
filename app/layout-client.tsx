'use client'

import './globals.css'
import 'reactflow/dist/style.css'
import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from '@/lib/theme'
import { useGlobalShortcuts } from '@/lib/keyboard-shortcuts'
import KeyboardShortcutsHelp from '@/components/KeyboardShortcutsHelp'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import PWARegister from '@/components/PWARegister'
import { usePathname } from 'next/navigation'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Функция для извлечения ID контакта из пути
function getCurrentContactId(pathname: string): number | undefined {
  const match = pathname.match(/^\/contacts\/(\d+)/)
  return match ? parseInt(match[1], 10) : undefined
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const currentContactId = getCurrentContactId(pathname)
  
  // Глобальные клавиатурные сокращения
  useGlobalShortcuts()

  return (
    <ErrorBoundary>
      <SessionProvider>
        <ThemeProvider>
          <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--surface)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: 'var(--shadow-lg)',
            },
            success: {
              iconTheme: {
                primary: 'var(--success)',
                secondary: 'var(--surface)',
              },
            },
            error: {
              iconTheme: {
                primary: 'var(--error)',
                secondary: 'var(--surface)',
              },
            },
          }}
        />
        <div className="flex min-h-screen bg-[var(--background)]">
          <Sidebar currentContactId={currentContactId} />
          <div className="flex-1 flex flex-col min-w-0">
            <Header />
            <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8 overflow-y-auto">
              {children}
            </main>
          </div>
          <KeyboardShortcutsHelp />
          <PWARegister />
        </div>
      </ThemeProvider>
    </SessionProvider>
    </ErrorBoundary>
  )
}

export default function LayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  return <LayoutContent>{children}</LayoutContent>
}