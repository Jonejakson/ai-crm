import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'

/**
 * Получить информацию о счете
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
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

    // Проверяем, что счет принадлежит компании пользователя
    if (invoice.subscription.companyId !== Number(currentUser.companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ invoice })
  } catch (error: any) {
    console.error('[billing][invoice][GET]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load invoice' },
      { status: 500 }
    )
  }
}

