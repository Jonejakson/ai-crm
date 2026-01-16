import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'
import { InvoiceStatus } from '@prisma/client'

/**
 * Получить неоплаченные счета компании
 */
export async function GET() {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Получаем все подписки компании
    const subscriptions = await prisma.subscription.findMany({
      where: {
        companyId: Number(currentUser.companyId),
      },
      select: {
        id: true,
      },
    })

    const subscriptionIds = subscriptions.map((s) => s.id)

    if (subscriptionIds.length === 0) {
      return NextResponse.json({ invoices: [] })
    }

    // Получаем неоплаченные счета
    const invoices = await prisma.invoice.findMany({
      where: {
        subscriptionId: { in: subscriptionIds },
        status: InvoiceStatus.PENDING,
      },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 3,
    })

    // Добавляем pdfUrl для каждого счета
    const baseUrl = process.env.NEXTAUTH_URL || 'https://flamecrm.ru'
    const invoicesWithPdfUrl = invoices.map((invoice) => ({
      ...invoice,
      pdfUrl: `${baseUrl}/api/billing/invoice/${invoice.id}/pdf`,
    }))

    return NextResponse.json({ invoices: invoicesWithPdfUrl })
  } catch (error: any) {
    console.error('[billing][invoices][pending][GET]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load pending invoices' },
      { status: 500 }
    )
  }
}
