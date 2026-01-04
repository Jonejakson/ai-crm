/**
 * Парсинг ticketId из email
 */

export interface ParsedEmail {
  subject: string
  body: string
  fromEmail: string
  fromName?: string
  messageId?: string
  inReplyTo?: string
  references?: string
  headers?: Record<string, string>
}

/**
 * Извлекает ticketId из темы письма
 * Формат: Re: [TKT-12345] Тема или [TKT-12345] Тема
 */
export function parseTicketIdFromSubject(subject: string): string | null {
  if (!subject) return null

  // Ищем паттерн [TKT-...]
  const match = subject.match(/\[(TKT-[^\]]+)\]/)
  if (match && match[1]) {
    return match[1]
  }

  return null
}

/**
 * Извлекает ticketId из заголовков email
 */
export function parseTicketIdFromHeaders(headers?: Record<string, string>): string | null {
  if (!headers) return null

  // Проверяем X-Ticket-ID заголовок
  const ticketId = headers['X-Ticket-ID'] || headers['x-ticket-id']
  if (ticketId) {
    return ticketId.trim()
  }

  return null
}

/**
 * Извлекает ticketId из Reply-To адреса
 * Формат: support+TKT-12345@flamecrm.ru
 */
export function parseTicketIdFromReplyTo(replyTo?: string): string | null {
  if (!replyTo) return null

  const match = replyTo.match(/\+TKT-([^\@]+)@/)
  if (match && match[1]) {
    return `TKT-${match[1]}`
  }

  return null
}

/**
 * Основная функция для извлечения ticketId из письма
 */
export function extractTicketId(email: ParsedEmail): string | null {
  // 1. Проверяем заголовки
  const fromHeaders = parseTicketIdFromHeaders(email.headers)
  if (fromHeaders) return fromHeaders

  // 2. Проверяем тему
  const fromSubject = parseTicketIdFromSubject(email.subject)
  if (fromSubject) return fromSubject

  // 3. Проверяем Reply-To (если есть в headers)
  if (email.headers?.['Reply-To']) {
    const fromReplyTo = parseTicketIdFromReplyTo(email.headers['Reply-To'])
    if (fromReplyTo) return fromReplyTo
  }

  return null
}

/**
 * Проверяет, является ли письмо ответом на тикет
 */
export function isTicketReply(email: ParsedEmail): boolean {
  // Проверяем тему на Re: или Fwd:
  const isReply = /^(Re|Fwd?):\s*/i.test(email.subject)
  
  // Или есть In-Reply-To заголовок
  const hasInReplyTo = !!email.inReplyTo

  // И есть ticketId
  const hasTicketId = !!extractTicketId(email)

  return (isReply || hasInReplyTo) && hasTicketId
}

/**
 * Извлекает текст ответа из письма (убирает цитаты)
 */
export function extractReplyText(body: string): string {
  if (!body) return ''

  // Убираем стандартные разделители цитат
  const quotePatterns = [
    /^On .+ wrote:.*$/m, // "On Mon, Dec 21, 2025 at 10:00 AM user@example.com wrote:"
    /^From:.*$/m,
    /^Sent:.*$/m,
    /^To:.*$/m,
    /^Subject:.*$/m,
    /^---.*$/m,
    /^>.*$/gm, // Цитаты с >
    /^-----Original Message-----.*$/m,
    /^________________________________.*$/m,
  ]

  let cleaned = body

  // Удаляем паттерны цитат
  for (const pattern of quotePatterns) {
    const match = cleaned.match(pattern)
    if (match) {
      const index = cleaned.indexOf(match[0])
      cleaned = cleaned.substring(0, index).trim()
    }
  }

  // Убираем пустые строки в начале и конце
  return cleaned.trim()
}







