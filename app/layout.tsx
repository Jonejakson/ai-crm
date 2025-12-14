import type { Metadata } from 'next'
import LayoutClient from './layout-client'

export const metadata: Metadata = {
  title: {
    default: 'Flame CRM - Управление клиентами и сделками',
    template: '%s | Flame CRM'
  },
  description: 'Flame CRM — современная CRM система для управления клиентами, сделками, задачами и аналитикой. Автоматизация продаж, интеграции, AI-ассистент.',
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
    'Flame CRM'
  ],
  authors: [{ name: 'Flame CRM' }],
  creator: 'Flame CRM',
  publisher: 'Flame CRM',
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: 'Flame CRM',
    title: 'Flame CRM - Управление клиентами и сделками',
    description: 'Flame CRM — современная CRM система для управления клиентами, сделками, задачами и аналитикой. Автоматизация продаж, интеграции, AI-ассистент.',
    url: '/',
    // images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Pocket CRM' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Flame CRM - Управление клиентами и сделками',
    description: 'Flame CRM — современная CRM система для управления клиентами, сделками, задачами и аналитикой.',
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
      <head>
        {/* PWA Meta Tags */}
        <meta name="application-name" content="Flame CRM" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Flame CRM" />
        <meta name="description" content="Flame CRM — современная CRM система для управления клиентами, сделками, задачами и аналитикой" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#3f6ff5" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#3f6ff5" />

        {/* Icons */}
        <link rel="icon" href="/icon.svg" />
        <link rel="apple-touch-icon" href="/icon.svg" />

        {/* Manifest */}
        <link rel="manifest" href="/manifest.webmanifest" />

        {/* PWA Splash Screens */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme');
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <LayoutClient>
          {children}
        </LayoutClient>
      </body>
    </html>
  )
}