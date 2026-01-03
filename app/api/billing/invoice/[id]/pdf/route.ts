import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'

type RouteContext = { params: Promise<{ id: string }> }

async function generateInvoicePdf(invoice: any, subscription: any, plan: any, company: any) {
  const pdfkitModule = (await import('pdfkit')) as any
  const PDFKit = pdfkitModule.default || pdfkitModule
  const doc = new PDFKit({ margin: 50, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))

  // Получаем данные самозанятого из переменных окружения
  const selfEmployedName = process.env.SELF_EMPLOYED_NAME || ''
  const selfEmployedInn = process.env.SELF_EMPLOYED_INN || ''
  const selfEmployedAccount = process.env.SELF_EMPLOYED_ACCOUNT || ''
  const selfEmployedBank = process.env.SELF_EMPLOYED_BANK || ''
  const selfEmployedBik = process.env.SELF_EMPLOYED_BIK || ''
  const selfEmployedCorrespondentAccount = process.env.SELF_EMPLOYED_CORRESPONDENT_ACCOUNT || ''

  // Рассчитываем период подписки
  const now = new Date()
  const periodEnd = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : new Date()
  const periodStart = new Date(invoice.createdAt)
  
  // Определяем период на основе разницы между датами
  const monthsDiff = Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24 * 30))
  const periodLabel = monthsDiff === 12 
    ? '1 год' 
    : monthsDiff === 6
    ? '6 месяцев'
    : monthsDiff === 3
    ? '3 месяца'
    : '1 месяц'

  // Заголовок
  doc.fontSize(20).font('Helvetica-Bold').text('СЧЕТ НА ОПЛАТУ', { align: 'center' }).moveDown(0.5)
  doc.fontSize(12).font('Helvetica').text(`№ ${invoice.id}`, { align: 'center' }).moveDown(1)

  // Дата
  doc.fontSize(10).text(`Дата: ${new Date(invoice.createdAt).toLocaleDateString('ru-RU')}`, { align: 'left' }).moveDown(1)

  // Плательщик
  doc.fontSize(12).font('Helvetica-Bold').text('Плательщик:', { continued: false })
  doc.fontSize(10).font('Helvetica').text(`Наименование: ${company.name}`)
  if (company.inn) {
    doc.text(`ИНН: ${company.inn}`)
  }
  doc.moveDown(1)

  // Получатель
  doc.fontSize(12).font('Helvetica-Bold').text('Получатель:', { continued: false })
  doc.fontSize(10).font('Helvetica').text(`Наименование: ${selfEmployedName}`)
  doc.text(`ИНН: ${selfEmployedInn}`)
  doc.moveDown(1)

  // Банковские реквизиты получателя
  doc.fontSize(12).font('Helvetica-Bold').text('Банковские реквизиты получателя:', { continued: false })
  doc.fontSize(10).font('Helvetica').text(`Расчетный счет: ${selfEmployedAccount}`)
  doc.text(`Банк: ${selfEmployedBank}`)
  doc.text(`БИК: ${selfEmployedBik}`)
  doc.text(`Корреспондентский счет: ${selfEmployedCorrespondentAccount}`)
  doc.moveDown(1)

  // Услуга
  doc.fontSize(12).font('Helvetica-Bold').text('Услуга:', { continued: false })
  doc.fontSize(10).font('Helvetica').text(`Подписка "${plan.name}"`)
  doc.text(`Период: ${periodLabel}`)
  doc.text(`Дата начала: ${periodStart.toLocaleDateString('ru-RU')}`)
  doc.text(`Дата окончания: ${periodEnd.toLocaleDateString('ru-RU')}`)
  doc.moveDown(1)

  // Сумма (хранится в рублях)
  const amount = invoice.amount
  doc.fontSize(14).font('Helvetica-Bold').text(`Сумма к оплате: ${amount.toLocaleString('ru-RU')} ${invoice.currency || 'RUB'}`, { align: 'right' })
  doc.moveDown(1)

  // Назначение платежа
  doc.fontSize(10).font('Helvetica').text(`Назначение платежа: Оплата подписки "${plan.name}" за период с ${periodStart.toLocaleDateString('ru-RU')} по ${periodEnd.toLocaleDateString('ru-RU')}`)
  doc.moveDown(2)

  // Подпись
  doc.fontSize(10).font('Helvetica').text('_________________________', { align: 'right' })
  doc.text(selfEmployedName, { align: 'right' })

  doc.end()
  await new Promise((resolve) => doc.on('end', resolve))
  return Buffer.concat(chunks)
}

export async function GET(request: NextRequest, ctx: RouteContext) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await ctx.params
    const invoiceId = Number(id)

    // Получаем счет с подпиской, планом и компанией
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
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
      return NextResponse.json({ error: 'Счет не найден' }, { status: 404 })
    }

    // Проверяем, что счет принадлежит компании пользователя
    if (invoice.subscription.companyId !== Number(currentUser.companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const pdf = await generateInvoicePdf(
      invoice,
      invoice.subscription,
      invoice.subscription.plan,
      invoice.subscription.company
    )

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=invoice-${invoiceId}.pdf`,
      },
    })
  } catch (error) {
    console.error('[billing][invoice][pdf][GET]', error)
    return NextResponse.json({ error: 'Не удалось сформировать счет' }, { status: 500 })
  }
}

