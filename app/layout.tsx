import type { Metadata } from 'next'
import LayoutClient from './layout-client'

export const metadata: Metadata = {
  title: 'CRM System',
  description: 'Customer Relationship Management',
}

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