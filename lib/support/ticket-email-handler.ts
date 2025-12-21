/**
 * Обработчик email ответов на тикеты поддержки
 */

import prisma from '@/lib/prisma'
import { extractTicketId, isTicketReply, extractReplyText } from './ticket-parser'
import type { ParsedEmail } from './ticket-parser'

export interface TicketEmailResult {
  processed: boolean
  ticketId?: string
  messageId?: number
  error?: string
}

/**
 * Обрабатывает email как ответ на тикет поддержки
 */
export async function processTicketReplyEmail(
  email: ParsedEmail,
  supportEmail: string = 'info@flamecrm.ru'
): Promise<TicketEmailResult> {
  try {
    // Проверяем, является ли это ответом на тикет
    if (!isTicketReply(email)) {
      return { processed: false }
    }

    // Извлекаем ticketId
    const ticketId = extractTicketId(email)
    if (!ticketId) {
      return { processed: false, error: 'Ticket ID not found in email' }
    }

    // Находим тикет
    const ticket = await prisma.supportTicket.findUnique({
      where: { ticketId },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    })

    if (!ticket) {
      return {
        processed: false,
        ticketId,
        error: `Ticket ${ticketId} not found`,
      }
    }

    // Проверяем, что письмо пришло на support email
    // (можно расширить проверку, если нужно)
    const isFromSupportEmail = email.fromEmail.toLowerCase() === supportEmail.toLowerCase()
    const isFromTicketUser = email.fromEmail.toLowerCase() === ticket.email.toLowerCase()

    // Определяем, кто отправил (админ или пользователь)
    // Если письмо от support email или от owner - это админ
    // Иначе - это пользователь
    const isFromAdmin = isFromSupportEmail

    // Извлекаем текст ответа (без цитат)
    const replyText = extractReplyText(email.body)
    if (!replyText || replyText.length < 1) {
      return {
        processed: false,
        ticketId,
        error: 'Reply text is empty',
      }
    }

    // Проверяем, не было ли уже обработано это письмо
    if (email.messageId) {
      const existingMessage = await prisma.supportTicketMessage.findFirst({
        where: {
          emailMessageId: email.messageId,
        },
      })

      if (existingMessage) {
        return {
          processed: true,
          ticketId,
          messageId: existingMessage.id,
        }
      }
    }

    // Создаем сообщение в тикете
    const message = await prisma.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        message: replyText,
        fromEmail: email.fromEmail,
        fromName: email.fromName || undefined,
        isFromAdmin,
        emailMessageId: email.messageId || undefined,
      },
    })

    // Обновляем статус тикета
    let newStatus = ticket.status
    if (isFromAdmin && ticket.status === 'open') {
      newStatus = 'in_progress'
    } else if (!isFromAdmin && ticket.status === 'in_progress') {
      newStatus = 'open' // Пользователь ответил, ждем ответа админа
    }

    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: newStatus,
        updatedAt: new Date(),
      },
    })

    // Отправляем уведомление пользователю (если ответ от админа)
    if (isFromAdmin && ticket.email) {
      // TODO: Отправить email уведомление пользователю
      // Можно использовать существующий sendEmail
    }

    return {
      processed: true,
      ticketId,
      messageId: message.id,
    }
  } catch (error) {
    console.error('[ticket-email-handler]', error)
    return {
      processed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Проверяет, нужно ли обрабатывать письмо как ответ на тикет
 */
export function shouldProcessAsTicketReply(
  email: ParsedEmail,
  supportEmail: string = 'info@flamecrm.ru'
): boolean {
  // Проверяем, что это ответ на тикет
  if (!isTicketReply(email)) {
    return false
  }

  // Проверяем, что письмо связано с support email
  // (либо пришло на support email, либо от него)
  const isToSupport = email.headers?.['To']?.toLowerCase().includes(supportEmail.toLowerCase())
  const isFromSupport = email.fromEmail.toLowerCase() === supportEmail.toLowerCase()
  const hasTicketId = !!extractTicketId(email)

  return hasTicketId && (isToSupport || isFromSupport)
}

