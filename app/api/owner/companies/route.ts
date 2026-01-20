import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'
import { isOwner } from '@/lib/owner'

type SubscriptionSummary = {
  id: number
  status: string
  planName: string | null
  planSlug: string | null
  billingInterval: string
  currentPeriodEnd: Date | null
  trialEndsAt: Date | null
  cancelAtPeriodEnd: boolean
  updatedAt: Date
}

const statusPriority: Record<string, number> = {
  ACTIVE: 4,
  TRIAL: 3,
  PAST_DUE: 2,
  CANCELED: 1,
}

const pickSubscription = (subs: SubscriptionSummary[]) => {
  if (!subs.length) return null
  return [...subs].sort((a, b) => {
    const byStatus = (statusPriority[b.status] || 0) - (statusPriority[a.status] || 0)
    if (byStatus !== 0) return byStatus
    return b.updatedAt.getTime() - a.updatedAt.getTime()
  })[0]
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOwner(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const now = new Date()
    const d10m = new Date(now.getTime() - 10 * 60 * 1000)

    const [companies, activity] = await Promise.all([
      prisma.company.findMany({
        select: {
          id: true,
          name: true,
          inn: true,
          isLegalEntity: true,
          createdAt: true,
          trialEndsAt: true,
          _count: {
            select: {
              users: true,
            },
          },
          subscriptions: {
            include: {
              plan: {
                select: {
                  name: true,
                  slug: true,
                },
              },
            },
            orderBy: {
              updatedAt: 'desc',
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.activityLog.groupBy({
        by: ['companyId', 'userId'],
        where: {
          createdAt: { gt: d10m },
          userId: { not: null },
        },
      }),
    ])

    const activeByCompany = new Map<number, number>()
    for (const row of activity) {
      const count = activeByCompany.get(row.companyId) || 0
      activeByCompany.set(row.companyId, count + 1)
    }

    const list = companies.map((company) => {
      const subs = company.subscriptions.map((s) => ({
        id: s.id,
        status: s.status,
        planName: s.plan?.name ?? null,
        planSlug: s.plan?.slug ?? null,
        billingInterval: s.billingInterval,
        currentPeriodEnd: s.currentPeriodEnd,
        trialEndsAt: s.trialEndsAt,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        updatedAt: s.updatedAt,
      }))

      const bestSub = pickSubscription(subs)

      return {
        id: company.id,
        name: company.name,
        inn: company.inn,
        isLegalEntity: company.isLegalEntity,
        createdAt: company.createdAt,
        trialEndsAt: company.trialEndsAt,
        usersCount: company._count.users,
        activeUsers10m: activeByCompany.get(company.id) || 0,
        subscription: bestSub,
      }
    })

    return NextResponse.json({ ok: true, companies: list })
  } catch (error) {
    console.error('[owner][companies]', error)
    return NextResponse.json({ error: 'Failed to load companies' }, { status: 500 })
  }
}

