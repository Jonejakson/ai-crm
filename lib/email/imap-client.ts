import Imap from 'imap'
import { simpleParser } from 'mailparser'

export interface ImapConfig {
  host: string
  port: number
  username: string
  password: string
  useSSL: boolean
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

export async function fetchEmailsFromImap(
  config: ImapConfig,
  since?: Date
): Promise<EmailMessage[]> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: config.username,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: config.useSSL,
      tlsOptions: { rejectUnauthorized: false },
    })

    const messages: EmailMessage[] = []

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          imap.end()
          return reject(err)
        }

        const searchCriteria = since ? ['UNSEEN', ['SINCE', since]] : ['UNSEEN']
        
        imap.search(searchCriteria, (err, results) => {
          if (err) {
            imap.end()
            return reject(err)
          }

          if (!results || results.length === 0) {
            imap.end()
            return resolve([])
          }

          const fetch = imap.fetch(results, { bodies: '' })
          
          fetch.on('message', (msg, seqno) => {
            let emailData = ''
            
            msg.on('body', (stream) => {
              stream.on('data', (chunk) => {
                emailData += chunk.toString('utf8')
              })
            })

            msg.once('end', () => {
              simpleParser(emailData)
                .then((parsed) => {
                  const email: EmailMessage = {
                    messageId: parsed.messageId || `imap-${seqno}-${Date.now()}`,
                    threadId: parsed.inReplyTo || undefined,
                    from: parsed.from?.text || '',
                    fromEmail: parsed.from?.value[0]?.address || '',
                    to: parsed.to?.value.map((addr) => addr.address || '') || [],
                    subject: parsed.subject || '',
                    body: parsed.text || '',
                    htmlBody: parsed.html || undefined,
                    date: parsed.date || new Date(),
                    attachments: parsed.attachments?.map((att) => ({
                      filename: att.filename || 'attachment',
                      contentType: att.contentType || 'application/octet-stream',
                      content: att.content as Buffer,
                    })),
                  }
                  messages.push(email)
                })
                .catch((parseErr) => {
                  console.error('[imap][parse]', parseErr)
                })
            })
          })

          fetch.once('end', () => {
            imap.end()
            resolve(messages)
          })
        })
      })
    })

    imap.once('error', (err) => {
      reject(err)
    })

    imap.connect()
  })
}

