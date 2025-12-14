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
      subsRaw,
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
      prisma.subscription.findMany({
        select: { companyId: true, status: true },
      }),
    ])

    // Считаем по уникальным компаниям
    const uniq = (arr: number[]) => Array.from(new Set(arr))
    const subsActiveCompanies = uniq(
      subsRaw.filter((s) => s.status === 'ACTIVE').map((s) => s.companyId)
    )
    const subsTrialCompanies = uniq(
      subsRaw.filter((s) => s.status === 'TRIAL').map((s) => s.companyId)
    )
    const subsCanceledCompanies = uniq(
      subsRaw.filter((s) => s.status === 'CANCELED').map((s) => s.companyId)
    )
    const subsAnyCompanies = uniq(subsRaw.map((s) => s.companyId))

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
        subsTotal: subsAnyCompanies.length,
        subsActive: subsActiveCompanies.length,
        subsTrial: subsTrialCompanies.length,
        subsCanceled: subsCanceledCompanies.length,
      },
    })
  } catch (error) {
    console.error('[owner][metrics]', error)
    return NextResponse.json({ error: 'Failed to load owner metrics' }, { status: 500 })
  }
}


