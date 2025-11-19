import type { Metadata } from 'next'
import LayoutClient from './layout-client'

export const metadata: Metadata = {
  title: {
    default: 'Aero CRM - Управление клиентами и сделками',
    template: '%s | Aero CRM'
  },
  description: 'Современная CRM система для управления клиентами, сделками, задачами и аналитикой',
  keywords: ['CRM', 'управление клиентами', 'сделки', 'задачи', 'аналитика'],
  authors: [{ name: 'Aero CRM' }],
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: 'Aero CRM',
    title: 'Aero CRM - Управление клиентами и сделками',
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