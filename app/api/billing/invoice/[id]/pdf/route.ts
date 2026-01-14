import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'

// Используем Node.js runtime для работы с pdfkit
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Генерация PDF счета для подписки
 */
async function generateInvoicePdf(invoice: any, subscription: any, company: any, plan: any) {
  try {
    // Динамический импорт pdfkit
    let PDFKit: any
    try {
      const pdfkitModule = await import('pdfkit')
      PDFKit = pdfkitModule.default || pdfkitModule
      
      // Если default не найден, пробуем получить из модуля напрямую
      if (!PDFKit && typeof pdfkitModule === 'function') {
        PDFKit = pdfkitModule
      }
    } catch (importError: any) {
      console.error('[generateInvoicePdf] Import error:', importError)
      throw new Error(`Failed to import pdfkit: ${importError?.message || 'Unknown error'}`)
    }
    
    if (!PDFKit) {
      throw new Error('PDFKit module not found after import')
    }
    
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
  
  // Назначение платежа с ID клиента
  doc.moveDown()
  doc.fontSize(12).font('Helvetica-Bold').text('Назначение платежа:', { align: 'left' })
  doc.fontSize(11).font('Helvetica')
  const paymentPurpose = `Оплата подписки ${plan.name} за ${periodLabel}. ID клиента: ${invoice.companyId || company.id}. Счет №${invoice.invoiceNumber || invoice.id}`
  doc.text(paymentPurpose, { align: 'left' })
  
  // Дополнительная информация
  doc.moveDown()
  doc.fontSize(10).text(`ID плательщика в системе: ${invoice.companyId || company.id}`, { align: 'left' })
  doc.text(`Номер счета: ${invoice.invoiceNumber || invoice.id}`, { align: 'left' })

    doc.end()
    await new Promise((resolve) => doc.on('end', resolve))
    return Buffer.concat(chunks)
  } catch (error: any) {
    console.error('[generateInvoicePdf] Error:', error)
    throw new Error(`PDF generation failed: ${error?.message || 'Unknown error'}`)
  }
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
        company: true, // Добавляем прямую связь с компанией
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Проверяем доступ: либо админ компании, либо owner
    const isOwner = currentUser.role === 'owner'
    const invoiceCompanyId = invoice.companyId || invoice.subscription?.companyId
    const isCompanyAdmin = currentUser.role === 'admin' && invoiceCompanyId === Number(currentUser.companyId)

    if (!isOwner && !isCompanyAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Получаем данные компании (из subscription или напрямую)
    const company = invoice.company || invoice.subscription?.company
    if (!company) {
      console.error('[billing][invoice][pdf][GET] Company not found for invoice:', invoice.id)
      return NextResponse.json({ error: 'Company data not found' }, { status: 500 })
    }

    // Получаем план (из subscription)
    const plan = invoice.subscription?.plan
    if (!plan) {
      console.error('[billing][invoice][pdf][GET] Plan not found for invoice:', invoice.id)
      return NextResponse.json({ error: 'Plan data not found' }, { status: 500 })
    }

    const pdf = await generateInvoicePdf(
      invoice,
      invoice.subscription,
      company,
      plan
    )

    const filename = `invoice-${invoice.invoiceNumber || invoice.id}.pdf`
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('[billing][invoice][pdf][GET]', error)
    console.error('[billing][invoice][pdf][GET] Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    })
    return NextResponse.json(
      { 
        error: 'Failed to generate PDF',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    )
  }
}
