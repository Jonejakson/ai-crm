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
                  // Обрабатываем from
                  const fromAddress = Array.isArray(parsed.from)
                    ? parsed.from[0]
                    : parsed.from
                  let fromEmail = ''
                  if (fromAddress?.value) {
                    if (Array.isArray(fromAddress.value)) {
                      fromEmail = fromAddress.value[0]?.address || ''
                    } else {
                      fromEmail = fromAddress.value.address || ''
                    }
                  }

                  // Обрабатываем to
                  const toAddresses: string[] = []
                  if (parsed.to) {
                    if (Array.isArray(parsed.to)) {
                      parsed.to.forEach((addr) => {
                        if (addr.value) {
                          if (Array.isArray(addr.value)) {
                            addr.value.forEach((v: any) => {
                              if (v && typeof v === 'object' && 'address' in v && v.address) {
                                toAddresses.push(v.address)
                              }
                            })
                          } else if (typeof addr.value === 'object' && addr.value && 'address' in addr.value) {
                            const addrValue = addr.value as { address?: string }
                            if (addrValue.address) {
                              toAddresses.push(addrValue.address)
                            }
                          }
                        }
                      })
                    } else {
                      if (parsed.to.value) {
                        if (Array.isArray(parsed.to.value)) {
                          parsed.to.value.forEach((v: any) => {
                            if (v && typeof v === 'object' && 'address' in v && v.address) {
                              toAddresses.push(v.address)
                            }
                          })
                        } else if (typeof parsed.to.value === 'object' && parsed.to.value && 'address' in parsed.to.value) {
                          const toValue = parsed.to.value as { address?: string }
                          if (toValue.address) {
                            toAddresses.push(toValue.address)
                          }
                        }
                      }
                    }
                  }

                  const email: EmailMessage = {
                    messageId: parsed.messageId || `imap-${seqno}-${Date.now()}`,
                    threadId: parsed.inReplyTo || undefined,
                    from: fromAddress?.text || fromEmail,
                    fromEmail,
                    to: toAddresses.filter((addr) => addr),
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

    imap.once('error', (err: Error) => {
      reject(err)
    })

    imap.connect()
  })
}

