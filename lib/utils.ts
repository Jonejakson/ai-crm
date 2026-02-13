// lib/utils.ts

/**
 * Форматирование российского номера: +7 (XXX) XXX-XX-XX
 * digits — до 10 цифр (без кода страны)
 */
export function formatPhoneRu(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10)
  if (d.length === 0) return ''
  if (d.length <= 3) return `+7 (${d}`
  if (d.length <= 6) return `+7 (${d.slice(0, 3)}) ${d.slice(3)}`
  if (d.length <= 8) return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`
}

/**
 * Из введённого значения извлекает цифры, 8/7 в начале трактует как код страны,
 * возвращает отформатированную строку +7 (XXX) XXX-XX-XX
 */
export function parsePhoneRuInput(value: string): string {
  const raw = value.replace(/\D/g, '')
  let digits = raw
  if (raw.startsWith('8')) digits = raw.slice(1)
  else if (raw.startsWith('7')) digits = raw.slice(1)
  digits = digits.slice(0, 10)
  if (digits.length === 0 && (raw === '8' || raw === '7')) return '+7 ('
  return formatPhoneRu(digits)
}

// Функция для извлечения ID контакта из URL пути
export function getContactIdFromPath(pathname: string): number | undefined {
  // Обрабатываем пути типа:
  // /contacts/123
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
  if (pathname.startsWith('/activity')) return 'activity'
  if (pathname.startsWith('/support')) return 'support'
  if (pathname.startsWith('/automations')) return 'automations'
  if (pathname.startsWith('/company')) return 'company'
  if (pathname.startsWith('/settings')) return 'settings'
  if (pathname.startsWith('/owner')) return 'owner'
  if (pathname.startsWith('/ops/support')) return 'ops-support'
  if (pathname.startsWith('/ops')) return 'ops'
  return 'dashboard'
}