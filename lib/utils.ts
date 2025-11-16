// lib/utils.ts

// Функция для извлечения ID контакта из URL пути
export function getContactIdFromPath(pathname: string): number | undefined {
  // Обрабатываем пути типа:
  // /contacts/123
  // /contacts/123/dialogs
  // /contacts/123/tasks
  const contactRouteMatch = pathname.match(/^\/contacts\/(\d+)/)
  if (contactRouteMatch) {
    return parseInt(contactRouteMatch[1], 10)
  }
  return undefined
}

// Функция для определения активного раздела
export function getActiveSection(pathname: string): string {
  if (pathname === '/') return 'dashboard'
  if (pathname.startsWith('/deals')) return 'deals'
  if (pathname.startsWith('/contacts')) return 'contacts'
  if (pathname.startsWith('/tasks')) return 'tasks'
  if (pathname.startsWith('/calendar')) return 'calendar'
  if (pathname.startsWith('/analytics')) return 'analytics'
  if (pathname.startsWith('/dialogs')) return 'dialogs'
  return 'dashboard'
}