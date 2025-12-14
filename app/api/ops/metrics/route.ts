import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'

// Простой эндпоинт метрик/здоровья для внутренней страницы операций

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Разрешаем доступ для admin и owner
  if (user.role !== 'admin' && user.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const now = new Date()
    const d24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const d10m = new Date(now.getTime() - 10 * 60 * 1000)
    const isOwner = user.role === 'owner'
    const companyId = isOwner ? undefined : Number(user.companyId)

    const [
      usersTotal,
      contactsTotal,
      dealsTotal,
      dealsLast24h,
      contactsLast24h,
      submissionsLast24h,
      activityLast10m,
    ] = await Promise.all([
      // Для owner - все пользователи, для admin - только своей компании
      prisma.user.count({ where: isOwner ? {} : { companyId: companyId! } }),
      prisma.contact.count({ where: isOwner ? {} : { user: { companyId: companyId! } } }),
      prisma.deal.count({ where: isOwner ? {} : { user: { companyId: companyId! } } }),
      prisma.deal.count({ where: isOwner ? { createdAt: { gt: d24h } } : { user: { companyId: companyId! }, createdAt: { gt: d24h } } }),
      prisma.contact.count({ where: isOwner ? { createdAt: { gt: d24h } } : { user: { companyId: companyId! }, createdAt: { gt: d24h } } }),
      prisma.webFormSubmission.count({
        where: isOwner ? { createdAt: { gt: d24h } } : { webForm: { companyId: companyId! }, createdAt: { gt: d24h } },
      }),
      prisma.activityLog.groupBy({
        by: ['userId'],
        where: {
          ...(isOwner ? {} : { companyId: companyId! }),
          createdAt: { gt: d10m },
          userId: { not: null },
        },
      }),
    ])

    // Проверка доступности БД (факт успешных запросов) + uptime процесса
    const dbOk = true
    const uptimeSeconds = Math.round(process.uptime())

    return NextResponse.json({
      ok: true,
      timestamp: now.toISOString(),
      dbOk,
      uptimeSeconds,
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


