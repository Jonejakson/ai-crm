import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'
import fs from 'fs'

// Используем Node.js runtime для работы с pdfkit
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SELLER = {
  type: 'Самозанятый',
  fio: 'Помазанова Елена Витальевна',
  inn: '420207922975',
  // Банковские реквизиты (если хотите — пришлите, и я подставлю в .env)
  bankName: process.env.BILLING_SELLER_BANK_NAME || '',
  bik: process.env.BILLING_SELLER_BIK || '',
  account: process.env.BILLING_SELLER_ACCOUNT || '',
  corrAccount: process.env.BILLING_SELLER_CORR_ACCOUNT || '',
}

function formatRub(amountRub: number) {
  const v = Number(amountRub || 0)
  return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getPeriodLabel(months: number) {
  if (months === 1) return '1 месяц'
  if (months === 3) return '3 месяца'
  if (months === 6) return '6 месяцев'
  return '12 месяцев'
}

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
    
    const doc = new PDFKit({ margin: 40, size: 'A4' })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))

    // Подключаем кириллический шрифт (DejaVu установим в контейнере через apk)
    const fontRegular = process.env.PDF_FONT_REGULAR || '/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf'
    const fontBold = process.env.PDF_FONT_BOLD || '/usr/share/fonts/ttf-dejavu/DejaVuSans-Bold.ttf'
    if (fs.existsSync(fontRegular)) doc.font(fontRegular)

    const pageWidth = doc.page.width
    const margin = (doc as any).options?.margin ?? 40
    const contentWidth = pageWidth - margin * 2
    const left = margin

    const invoiceNo = invoice.invoiceNumber || String(invoice.id)
    const invoiceDate = new Date(invoice.createdAt).toLocaleDateString('ru-RU')
    const periodLabel = getPeriodLabel(Number(invoice.paymentPeriodMonths || 1))
    const clientId = invoice.companyId || company.id

    // Заголовок
    if (fs.existsSync(fontBold)) doc.font(fontBold)
    doc.fontSize(16).text(`Счет на оплату № ${invoiceNo} от ${invoiceDate}`, left, doc.y, { width: contentWidth, align: 'center' })
    if (fs.existsSync(fontRegular)) doc.font(fontRegular)
    doc.moveDown(0.8)

    // Поставщик / Покупатель
    const labelW = 90
    const lineGap = 6
    const rowH = 48

    // Рамка блока реквизитов
    const blockY = doc.y
    doc.rect(left, blockY, contentWidth, rowH).stroke()

    // Поставщик
    if (fs.existsSync(fontBold)) doc.font(fontBold)
    doc.fontSize(10).text('Поставщик:', left + 6, blockY + 8, { width: labelW })
    if (fs.existsSync(fontRegular)) doc.font(fontRegular)
    doc.fontSize(10).text(
      `${SELLER.type} ${SELLER.fio}, ИНН ${SELLER.inn}`,
      left + 6 + labelW,
      blockY + 8,
      { width: contentWidth - labelW - 12 }
    )

    // Покупатель
    if (fs.existsSync(fontBold)) doc.font(fontBold)
    doc.fontSize(10).text('Покупатель:', left + 6, blockY + 26, { width: labelW })
    if (fs.existsSync(fontRegular)) doc.font(fontRegular)
    const buyerInn = company?.inn ? `, ИНН ${company.inn}` : ''
    doc.fontSize(10).text(
      `${company?.name || '—'}${buyerInn}`,
      left + 6 + labelW,
      blockY + 26,
      { width: contentWidth - labelW - 12 }
    )

    doc.y = blockY + rowH + 12

    // Банковские реквизиты (если заданы)
    if (SELLER.bankName || SELLER.bik || SELLER.account || SELLER.corrAccount) {
      if (fs.existsSync(fontBold)) doc.font(fontBold)
      doc.fontSize(11).text('Реквизиты получателя:', left, doc.y)
      if (fs.existsSync(fontRegular)) doc.font(fontRegular)
      doc.moveDown(0.4)
      const recLines: string[] = []
      if (SELLER.bankName) recLines.push(`Банк: ${SELLER.bankName}`)
      if (SELLER.bik) recLines.push(`БИК: ${SELLER.bik}`)
      if (SELLER.account) recLines.push(`р/с: ${SELLER.account}`)
      if (SELLER.corrAccount) recLines.push(`к/с: ${SELLER.corrAccount}`)
      recLines.forEach((l) => doc.fontSize(10).text(l, left, doc.y, { lineGap }))
      doc.moveDown(0.8)
    }

    // Таблица
    const tableTop = doc.y
    const col = {
      n: 28,
      name: contentWidth - 28 - 60 - 40 - 90,
      qty: 60,
      unit: 40,
      price: 90,
      sum: 90,
    }
    const x = {
      n: left,
      name: left + col.n,
      qty: left + col.n + col.name,
      unit: left + col.n + col.name + col.qty,
      price: left + col.n + col.name + col.qty + col.unit,
      sum: left + col.n + col.name + col.qty + col.unit + col.price,
    }

    const headerH = 22
    doc.rect(left, tableTop, contentWidth, headerH).stroke()
    if (fs.existsSync(fontBold)) doc.font(fontBold)
    doc.fontSize(10)
    doc.text('№', x.n + 6, tableTop + 6, { width: col.n - 12 })
    doc.text('Товары (работы, услуги)', x.name + 6, tableTop + 6, { width: col.name - 12 })
    doc.text('Кол-во', x.qty + 6, tableTop + 6, { width: col.qty - 12, align: 'right' })
    doc.text('Ед.', x.unit + 6, tableTop + 6, { width: col.unit - 12, align: 'right' })
    doc.text('Цена', x.price + 6, tableTop + 6, { width: col.price - 12, align: 'right' })
    doc.text('Сумма', x.sum + 6, tableTop + 6, { width: col.sum - 12, align: 'right' })

    // Вертикальные линии
    doc.moveTo(x.name, tableTop).lineTo(x.name, tableTop + headerH).stroke()
    doc.moveTo(x.qty, tableTop).lineTo(x.qty, tableTop + headerH).stroke()
    doc.moveTo(x.unit, tableTop).lineTo(x.unit, tableTop + headerH).stroke()
    doc.moveTo(x.price, tableTop).lineTo(x.price, tableTop + headerH).stroke()
    doc.moveTo(x.sum, tableTop).lineTo(x.sum, tableTop + headerH).stroke()

    // Строка услуги
    const rowY = tableTop + headerH
    const rowH2 = 54
    doc.rect(left, rowY, contentWidth, rowH2).stroke()
    // Вертикальные линии строки
    doc.moveTo(x.name, rowY).lineTo(x.name, rowY + rowH2).stroke()
    doc.moveTo(x.qty, rowY).lineTo(x.qty, rowY + rowH2).stroke()
    doc.moveTo(x.unit, rowY).lineTo(x.unit, rowY + rowH2).stroke()
    doc.moveTo(x.price, rowY).lineTo(x.price, rowY + rowH2).stroke()
    doc.moveTo(x.sum, rowY).lineTo(x.sum, rowY + rowH2).stroke()

    if (fs.existsSync(fontRegular)) doc.font(fontRegular)
    const serviceName = `Оплата услуг CRM системы Flame CRM за ${periodLabel} (ID клиента: ${clientId})`
    doc.fontSize(10)
    doc.text('1', x.n + 6, rowY + 8, { width: col.n - 12 })
    doc.text(serviceName, x.name + 6, rowY + 8, { width: col.name - 12 })
    doc.text('1', x.qty + 6, rowY + 8, { width: col.qty - 12, align: 'right' })
    doc.text('усл.', x.unit + 6, rowY + 8, { width: col.unit - 12, align: 'right' })
    doc.text(formatRub(Number(invoice.amount || 0)), x.price + 6, rowY + 8, { width: col.price - 12, align: 'right' })
    doc.text(formatRub(Number(invoice.amount || 0)), x.sum + 6, rowY + 8, { width: col.sum - 12, align: 'right' })

    doc.y = rowY + rowH2 + 10

    // Итого
    if (fs.existsSync(fontBold)) doc.font(fontBold)
    doc.fontSize(11).text(`Итого: ${formatRub(Number(invoice.amount || 0))} ${invoice.currency || 'RUB'}`, left, doc.y, { width: contentWidth, align: 'right' })
    if (fs.existsSync(fontRegular)) doc.font(fontRegular)
    doc.fontSize(10).text('НДС не облагается (самозанятый).', left, doc.y + 4, { width: contentWidth, align: 'right' })
    doc.moveDown(1.2)

    // Назначение платежа
    if (fs.existsSync(fontBold)) doc.font(fontBold)
    doc.fontSize(11).text('Назначение платежа:', left, doc.y)
    if (fs.existsSync(fontRegular)) doc.font(fontRegular)
    doc.fontSize(10).text(`Оплата услуг CRM системы Flame CRM. ID клиента: ${clientId}.`, left, doc.y + 2, { width: contentWidth })
    doc.moveDown(0.8)

    // Примечание
    doc.fontSize(9).text('Счет действителен 5 календарных дней.', left, doc.y, { width: contentWidth })

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
