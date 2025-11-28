import nodemailer from 'nodemailer'

export interface SmtpConfig {
  host: string
  port: number
  username: string
  password: string
  useSSL: boolean
  fromEmail: string
  fromName?: string
}

export interface EmailSendOptions {
  to: string | string[]
  subject: string
  body: string
  htmlBody?: string
  attachments?: Array<{
    filename: string
    content: Buffer
    contentType?: string
  }>
}

export async function sendEmailViaSmtp(
  config: SmtpConfig,
  options: EmailSendOptions
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.useSSL && config.port === 465,
    auth: {
      user: config.username,
      pass: config.password,
    },
  })

  const to = Array.isArray(options.to) ? options.to : [options.to]

  await transporter.sendMail({
    from: config.fromName
      ? `${config.fromName} <${config.fromEmail}>`
      : config.fromEmail,
    to: to.join(', '),
    subject: options.subject,
    text: options.body,
    html: options.htmlBody,
    attachments: options.attachments?.map((att) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
    })),
  })
}

