import { Client } from '@microsoft/microsoft-graph-client'

export interface OutlookConfig {
  accessToken: string
  refreshToken: string
  email: string
}

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
  attachments?: Array<{
    filename: string
    contentType: string
    content: Buffer
  }>
}

export async function fetchEmailsFromOutlook(
  config: OutlookConfig,
  since?: Date
): Promise<EmailMessage[]> {
  try {
    // Создаем клиент Microsoft Graph с простым провайдером токенов
    const client = Client.init({
      authProvider: (done) => {
        done(null, config.accessToken)
      },
    })

    // Формируем фильтр для запроса
    const filter = since
      ? `receivedDateTime ge ${since.toISOString()} and isRead eq false`
      : 'isRead eq false'

    // Получаем сообщения
    const response = await client
      .api('/me/messages')
      .filter(filter)
      .top(50)
      .get()

    const messages = response.value || []
    
    return messages.map((msg: any) => {
      const from = msg.from?.emailAddress || {}
      const toAddresses = msg.toRecipients?.map((r: any) => r.emailAddress?.address || '') || []

      return {
        messageId: msg.id || '',
        threadId: msg.conversationId || undefined,
        from: from.name || '',
        fromEmail: from.address || '',
        to: toAddresses,
        subject: msg.subject || '',
        body: msg.bodyPreview || msg.body?.content || '',
        htmlBody: msg.body?.contentType === 'html' ? msg.body.content : undefined,
        date: new Date(msg.receivedDateTime || msg.createdDateTime || Date.now()),
        attachments: msg.hasAttachments
          ? [] // TODO: Загружать вложения отдельным запросом
          : undefined,
      }
    })
  } catch (error) {
    console.error('[outlook][fetch]', error)
    throw error
  }
}

