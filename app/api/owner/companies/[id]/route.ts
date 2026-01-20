import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'
import { isOwner } from '@/lib/owner'

const statusPriority: Record<string, number> = {
  ACTIVE: 4,
  TRIAL: 3,
  PAST_DUE: 2,
  CANCELED: 1,
}

const pickSubscription = <T extends { status: string; updatedAt: Date }>(subs: T[]) => {
  if (!subs.length) return null
  return [...subs].sort((a, b) => {
    const byStatus = (statusPriority[b.status] || 0) - (statusPriority[a.status] || 0)
    if (byStatus !== 0) return byStatus
    return b.updatedAt.getTime() - a.updatedAt.getTime()
  })[0]
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOwner(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(request.url)
  const idFromPath = url.pathname.split('/').filter(Boolean).pop()
  const companyId = Number(idFromPath)
  if (!companyId || Number.isNaN(companyId)) {
    return NextResponse.json({ error: 'Invalid company id' }, { status: 400 })
  }

  try {
    const now = new Date()
    const d10m = new Date(now.getTime() - 10 * 60 * 1000)

    const [company, activeUsersRaw, contacts, contactsTotal] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: {
          id: true,
          name: true,
          inn: true,
          isLegalEntity: true,
          createdAt: true,
          updatedAt: true,
          trialEndsAt: true,
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: 'asc',
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
      }),
      prisma.activityLog.groupBy({
        by: ['userId'],
        where: {
          companyId,
          createdAt: { gt: d10m },
          userId: { not: null },
        },
      }),
      prisma.contact.findMany({
        where: {
          user: {
            companyId,
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          company: true,
          position: true,
          inn: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 200,
      }),
      prisma.contact.count({
        where: {
          user: {
            companyId,
          },
        },
      }),
    ])

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const subscription = pickSubscription(
      company.subscriptions.map((s) => ({
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
    )

    return NextResponse.json({
      ok: true,
      company: {
        id: company.id,
        name: company.name,
        inn: company.inn,
        isLegalEntity: company.isLegalEntity,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
        trialEndsAt: company.trialEndsAt,
        users: company.users,
      },
      subscription,
      stats: {
        usersTotal: company.users.length,
        activeUsers10m: activeUsersRaw.length,
        contactsTotal,
      },
      contacts,
      contactsLimit: 200,
    })
  } catch (error) {
    console.error('[owner][company-details]', error)
    return NextResponse.json({ error: 'Failed to load company details' }, { status: 500 })
  }
}

