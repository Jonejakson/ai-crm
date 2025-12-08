import nodemailer from 'nodemailer'

let transporter: nodemailer.Transporter | null = null

function ensureConfig() {
  const { MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASSWORD, MAIL_FROM } = process.env
  if (!MAIL_HOST || !MAIL_PORT || !MAIL_USER || !MAIL_PASSWORD || !MAIL_FROM) {
    throw new Error('SMTP настройки не заданы. Заполните MAIL_HOST/MAIL_PORT/MAIL_USER/MAIL_PASSWORD/MAIL_FROM')
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: MAIL_HOST,
      port: Number(MAIL_PORT),
      secure: Number(MAIL_PORT) === 465,
      auth: {
        user: MAIL_USER,
        pass: MAIL_PASSWORD,
      },
    })
  }

  return {
    from: MAIL_FROM,
    transporter,
  }
}

export function isEmailConfigured() {
  const { MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASSWORD, MAIL_FROM } = process.env
  return Boolean(MAIL_HOST && MAIL_PORT && MAIL_USER && MAIL_PASSWORD && MAIL_FROM)
}

interface Attachment {
  filename: string
  content: Buffer | string
  contentType?: string
}

interface SendEmailPayload {
  to: string
  subject: string
  text?: string
  html?: string
  attachments?: Attachment[]
}

export async function sendEmail(payload: SendEmailPayload) {
  const { transporter, from } = ensureConfig()
  const info = await transporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text ?? payload.html,
    html: payload.html,
    attachments: payload.attachments,
  })

  return info
}

