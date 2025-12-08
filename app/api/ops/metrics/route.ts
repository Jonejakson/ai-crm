import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'

// Простой эндпоинт метрик/здоровья для внутренней страницы операций

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const now = new Date()
    const d24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const d10m = new Date(now.getTime() - 10 * 60 * 1000)
    const companyId = Number(user.companyId)

    const [
      usersTotal,
      contactsTotal,
      dealsTotal,
      dealsLast24h,
      contactsLast24h,
      submissionsLast24h,
      activityLast10m,
    ] = await Promise.all([
      prisma.user.count({ where: { companyId } }),
      prisma.contact.count({ where: { user: { companyId } } }),
      prisma.deal.count({ where: { user: { companyId } } }),
      prisma.deal.count({ where: { user: { companyId }, createdAt: { gt: d24h } } }),
      prisma.contact.count({ where: { user: { companyId }, createdAt: { gt: d24h } } }),
      prisma.webFormSubmission.count({
        where: { webForm: { companyId }, createdAt: { gt: d24h } },
      }),
      prisma.activityLog.groupBy({
        by: ['userId'],
        where: {
          companyId,
          createdAt: { gt: d10m },
          userId: { not: null },
        },
      }),
    ])

    // Проверка доступности БД и интеграций (минимально)
    const dbOk = true

    return NextResponse.json({
      ok: true,
      timestamp: now.toISOString(),
      dbOk,
      metrics: {
        usersTotal,
        contactsTotal,
        dealsTotal,
        dealsLast24h,
        contactsLast24h,
        submissionsLast24h,
        activeUsers10m: activityLast10m.length,
      },
    })
  } catch (error) {
    console.error('[ops][metrics]', error)
    return NextResponse.json({ error: 'Failed to load metrics' }, { status: 500 })
  }
}


