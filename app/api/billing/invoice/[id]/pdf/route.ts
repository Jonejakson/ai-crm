import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'

/**
 * Генерация PDF счета для подписки
 */
async function generateInvoicePdf(invoice: any, subscription: any, company: any, plan: any) {
  const pdfkitModule = (await import('pdfkit')) as any
  const PDFKit = pdfkitModule.default || pdfkitModule
  const doc = new PDFKit({ margin: 40 })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))

  // Заголовок
  doc.fontSize(20).text('СЧЕТ НА ОПЛАТУ', { align: 'center' }).moveDown()
  
  // Номер счета и дата
  doc.fontSize(12)
  doc.text(`Номер счета: ${invoice.invoiceNumber || invoice.id}`, { align: 'left' })
  doc.text(`Дата создания: ${new Date(invoice.createdAt).toLocaleDateString('ru-RU')}`, { align: 'left' })
  doc.moveDown()

  // Плательщик
  doc.fontSize(14).text('Плательщик:', { underline: true }).moveDown(0.5)
  doc.fontSize(12)
  doc.text(`Компания: ${company.name}`)
  if (company.inn) {
    doc.text(`ИНН: ${company.inn}`)
  }
  doc.moveDown()

  // Получатель (можно добавить реквизиты вашей компании)
  doc.fontSize(14).text('Получатель:', { underline: true }).moveDown(0.5)
  doc.fontSize(12)
  doc.text('ООО "Flame CRM"') // TODO: Добавить настройки компании в базу данных
  doc.moveDown()

  // Услуга
  doc.fontSize(14).text('Услуга:', { underline: true }).moveDown(0.5)
  doc.fontSize(12)
  doc.text(`Подписка: ${plan.name}`)
  
  const periodLabel = invoice.paymentPeriodMonths === 1
    ? '1 месяц'
    : invoice.paymentPeriodMonths === 3
    ? '3 месяца'
    : invoice.paymentPeriodMonths === 6
    ? '6 месяцев'
    : '12 месяцев'
  
  doc.text(`Период оплаты: ${periodLabel}`)
  doc.moveDown()

  // Сумма
  doc.fontSize(14).text('К оплате:', { underline: true }).moveDown(0.5)
  doc.fontSize(16).font('Helvetica-Bold')
  // Цена хранится в минорных единицах (копейки для RUB), конвертируем в рубли
  const amountInRubles = invoice.currency === 'RUB' ? (invoice.amount / 100).toFixed(2) : invoice.amount.toString()
  doc.text(`${amountInRubles} ${invoice.currency || 'RUB'}`, { align: 'left' })
  doc.fontSize(12).font('Helvetica') // Возвращаем обычный шрифт
  doc.moveDown()

  // Примечание
  doc.fontSize(10).text('Примечание: Оплата производится по реквизитам, указанным в договоре.', { align: 'left' })
  
  // ID плательщика для подтверждения оплаты
  doc.moveDown()
  doc.fontSize(10).text(`ID плательщика в системе: ${invoice.companyId}`, { align: 'left' })
  doc.text(`Номер счета: ${invoice.invoiceNumber || invoice.id}`, { align: 'left' })

  doc.end()
  await new Promise((resolve) => doc.on('end', resolve))
  return Buffer.concat(chunks)
}

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, ctx: RouteContext) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await ctx.params
    const invoice = await prisma.invoice.findUnique({
      where: { id: parseInt(id) },
      include: {
        subscription: {
          include: {
            plan: true,
            company: true,
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Проверяем доступ: либо админ компании, либо owner
    const isOwner = currentUser.role === 'owner'
    const isCompanyAdmin = currentUser.role === 'admin' && invoice.subscription.companyId === Number(currentUser.companyId)

    if (!isOwner && !isCompanyAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const pdf = await generateInvoicePdf(
      invoice,
      invoice.subscription,
      invoice.subscription.company,
      invoice.subscription.plan
    )

    const filename = `invoice-${invoice.invoiceNumber || invoice.id}.pdf`
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('[billing][invoice][pdf][GET]', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
