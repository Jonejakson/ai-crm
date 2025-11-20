import type { Metadata } from 'next'
import LayoutClient from './layout-client'

export const metadata: Metadata = {
  title: {
    default: 'Pocket CRM - Управление клиентами и сделками',
    template: '%s | Pocket CRM'
  },
  description: 'Современная CRM система для управления клиентами, сделками, задачами и аналитикой',
  keywords: ['CRM', 'управление клиентами', 'сделки', 'задачи', 'аналитика'],
  authors: [{ name: 'Pocket CRM' }],
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: 'Pocket CRM',
    title: 'Pocket CRM - Управление клиентами и сделками',
    description: 'Современная CRM система для управления клиентами, сделками, задачами и аналитикой',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body>
        <LayoutClient>
          {children}
        </LayoutClient>
      </body>
    </html>
  )
}