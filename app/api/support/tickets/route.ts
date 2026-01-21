import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'
import { isOwner } from '@/lib/owner'

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (user.role !== 'owner' && !isOwner(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const companyIdParam = searchParams.get('companyId')

    const where: {
      status?: string
      companyId?: number
    } = {}

    if (status && status !== 'all') {
      where.status = status
    }
    if (companyIdParam && !Number.isNaN(Number(companyIdParam))) {
      where.companyId = Number(companyIdParam)
    }

    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        company: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ ok: true, tickets })
  } catch (error) {
    console.error('[support][tickets][GET]', error)
    return NextResponse.json({ error: 'Не удалось загрузить тикеты' }, { status: 500 })
  }
}
