import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'
import { isOwner } from '@/lib/owner'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOwner(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const now = new Date()
    const d24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const d10m = new Date(now.getTime() - 10 * 60 * 1000)

    const [
      companiesTotal,
      companies24h,
      usersTotal,
      activeUsers10m,
      dealsTotal,
      contactsTotal,
      submissions24h,
      subsActive,
      subsTrial,
    ] = await Promise.all([
      prisma.company.count(),
      prisma.company.count({ where: { createdAt: { gt: d24h } } }),
      prisma.user.count(),
      prisma.activityLog.groupBy({
        by: ['userId'],
        where: { createdAt: { gt: d10m }, userId: { not: null } },
      }),
      prisma.deal.count(),
      prisma.contact.count(),
      prisma.webFormSubmission.count({ where: { createdAt: { gt: d24h } } }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
      prisma.subscription.count({ where: { status: 'TRIAL' } }).catch(() => 0),
    ])

    return NextResponse.json({
      ok: true,
      timestamp: now.toISOString(),
      metrics: {
        companiesTotal,
        companies24h,
        usersTotal,
        activeUsers10m: activeUsers10m.length,
        dealsTotal,
        contactsTotal,
        submissions24h,
        subsActive,
        subsTrial,
      },
    })
  } catch (error) {
    console.error('[owner][metrics]', error)
    return NextResponse.json({ error: 'Failed to load owner metrics' }, { status: 500 })
  }
}


