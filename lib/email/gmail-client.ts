import { google } from 'googleapis'

export interface GmailConfig {
  accessToken: string
  refreshToken: string
  email: string
}

export interface EmailMessage {
  messageId: string
  threadId: string
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

export async function fetchEmailsFromGmail(
  config: GmailConfig,
  since?: Date
): Promise<EmailMessage[]> {
  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({
    access_token: config.accessToken,
    refresh_token: config.refreshToken,
  })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  try {
    // Получаем список сообщений
    const query = since ? `after:${Math.floor(since.getTime() / 1000)}` : 'is:unread'
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 50,
    })

    const messages = response.data.messages || []
    if (messages.length === 0) {
      return []
    }

    // Получаем детали каждого сообщения
    const emailMessages: EmailMessage[] = []
    
    for (const msg of messages) {
      if (!msg.id) continue

      const messageResponse = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      })

      const message = messageResponse.data
      const headers = message.payload?.headers || []
      
      const getHeader = (name: string) => {
        const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
        return header?.value || ''
      }

      const fromHeader = getHeader('From')
      const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$|^(.+?)$/)
      const fromName = fromMatch ? (fromMatch[1] || fromMatch[3] || '').trim() : ''
      const fromEmail = fromMatch ? (fromMatch[2] || fromMatch[3] || '').trim() : fromHeader

      const toHeader = getHeader('To')
      const toEmails = toHeader.split(',').map((email) => {
        const match = email.trim().match(/<(.+?)>|(.+)/)
        return match ? (match[1] || match[2] || '').trim() : email.trim()
      })

      // Извлекаем тело письма
      let body = ''
      let htmlBody = ''
      
      const extractBody = (part: any) => {
        if (part.body?.data) {
          const content = Buffer.from(part.body.data, 'base64').toString('utf-8')
          if (part.mimeType === 'text/html') {
            htmlBody = content
          } else if (part.mimeType === 'text/plain') {
            body = content
          }
        }
        if (part.parts) {
          part.parts.forEach(extractBody)
        }
      }

      if (message.payload) {
        extractBody(message.payload)
      }

      emailMessages.push({
        messageId: message.id || '',
        threadId: message.threadId || '',
        from: fromName,
        fromEmail,
        to: toEmails,
        subject: getHeader('Subject'),
        body: body || htmlBody.replace(/<[^>]*>/g, '') || '',
        htmlBody: htmlBody || undefined,
        date: new Date(parseInt(message.internalDate || '0')),
      })
    }

    return emailMessages
  } catch (error) {
    console.error('[gmail][fetch]', error)
    throw error
  }
}

