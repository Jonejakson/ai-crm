import type { Metadata } from 'next'
import LayoutClient from './layout-client'

export const metadata: Metadata = {
  title: {
    default: 'Pocket CRM - Управление клиентами и сделками',
    template: '%s | Pocket CRM'
  },
  description: 'Современная CRM система для управления клиентами, сделками, задачами и аналитикой. Автоматизация продаж, интеграции, AI-ассистент.',
  keywords: [
    'CRM',
    'управление клиентами',
    'сделки',
    'задачи',
    'аналитика',
    'продажи',
    'автоматизация',
    'воронка продаж',
    'управление контактами',
    'CRM система',
    'Pocket CRM'
  ],
  authors: [{ name: 'Pocket CRM' }],
  creator: 'Pocket CRM',
  publisher: 'Pocket CRM',
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: 'Pocket CRM',
    title: 'Pocket CRM - Управление клиентами и сделками',
    description: 'Современная CRM система для управления клиентами, сделками, задачами и аналитикой. Автоматизация продаж, интеграции, AI-ассистент.',
    url: '/',
    // images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Pocket CRM' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pocket CRM - Управление клиентами и сделками',
    description: 'Современная CRM система для управления клиентами, сделками, задачами и аналитикой.',
    // images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
  },
  alternates: {
    canonical: '/',
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