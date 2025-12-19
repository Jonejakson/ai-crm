import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'

// Простой эндпоинт метрик/здоровья для внутренней страницы операций

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Только owner имеет доступ к операционному мониторингу
  if (user.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden: Owner only' }, { status: 403 })
  }

  try {
    const now = new Date()
    const d24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const d10m = new Date(now.getTime() - 10 * 60 * 1000)
    // Для owner показываем все данные системы

    const [
      usersTotal,
      contactsTotal,
      dealsTotal,
      dealsLast24h,
      contactsLast24h,
      submissionsLast24h,
      activityLast10m,
    ] = await Promise.all([
      // Owner видит все данные системы
      prisma.user.count(),
      prisma.contact.count(),
      prisma.deal.count(),
      prisma.deal.count({ where: { createdAt: { gt: d24h } } }),
      prisma.contact.count({ where: { createdAt: { gt: d24h } } }),
      prisma.webFormSubmission.count({
        where: { createdAt: { gt: d24h } },
      }),
      prisma.activityLog.groupBy({
        by: ['userId'],
        where: {
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


