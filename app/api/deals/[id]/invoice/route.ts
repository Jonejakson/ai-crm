import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendEmail, isEmailConfigured } from '@/lib/email'

// Генерация PDF счета/квита по сделке

async function generatePdfBuffer(deal: any, contact: any) {
  // Import the package entry (CJS) to avoid Turbopack/webpack ESM helper issues
  const pdfkitModule = (await import('pdfkit')) as any
  const PDFKit = pdfkitModule.default || pdfkitModule
  const doc = new PDFKit({ margin: 40 })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))

  doc.fontSize(18).text('Счет / Invoice', { align: 'center' }).moveDown()
  doc.fontSize(12)
  doc.text(`Дата: ${new Date().toLocaleString('ru-RU')}`)
  doc.text(`Сделка: ${deal.title}`)
  doc.text(`Сумма: ${deal.amount} ${deal.currency}`)
  doc.text(`Этап: ${deal.stage}`)
  doc.moveDown()
  doc.text('Клиент:')
  doc.text(`Имя: ${contact?.name || '-'}`)
  doc.text(`Email: ${contact?.email || '-'}`)
  doc.text(`Телефон: ${contact?.phone || '-'}`)
  doc.text(`Компания: ${contact?.company || '-'}`)
  doc.moveDown()
  doc.text('Комментарий:')
  doc.text(deal.description || '—')

  doc.end()
  await new Promise((resolve) => doc.on('end', resolve))
  return Buffer.concat(chunks)
}

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    const url = new URL(request.url)
    const sendEmailFlag = url.searchParams.get('sendEmail') === '1'
    const emailTo = url.searchParams.get('email')

    const deal = await prisma.deal.findUnique({
      where: { id: Number(id) },
      include: {
        contact: true,
      },
    })

    if (!deal) {
      return NextResponse.json({ error: 'Сделка не найдена' }, { status: 404 })
    }

    const pdf = await generatePdfBuffer(deal, deal.contact)

    if (sendEmailFlag) {
      if (!emailTo && !deal.contact?.email) {
        return NextResponse.json({ error: 'Нет email для отправки' }, { status: 400 })
      }
      if (!isEmailConfigured()) {
        return NextResponse.json({ error: 'SMTP не настроен' }, { status: 500 })
      }
      await sendEmail({
        to: emailTo || (deal.contact?.email as string),
        subject: `Счет по сделке: ${deal.title}`,
        text: `Счет по сделке "${deal.title}" во вложении.`,
        attachments: [
          {
            filename: `invoice-${deal.id}.pdf`,
            content: pdf,
            contentType: 'application/pdf',
          },
        ],
      })
      return NextResponse.json({ success: true, message: 'Счет отправлен' })
    }

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=invoice-${deal.id}.pdf`,
      },
    })
  } catch (error) {
    console.error('[invoice][GET]', error)
    return NextResponse.json({ error: 'Не удалось сформировать счет' }, { status: 500 })
  }
}


