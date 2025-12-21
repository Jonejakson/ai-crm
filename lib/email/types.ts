// Общие типы для email клиентов

export interface EmailMessage {
  messageId: string
  threadId?: string
  from: string
  fromEmail: string
  to: string[]
  subject: string
  body: string
  htmlBody?: string
  date: Date
  headers?: Record<string, string>
  attachments?: Array<{
    filename: string
    contentType: string
    content: Buffer
  }>
}

