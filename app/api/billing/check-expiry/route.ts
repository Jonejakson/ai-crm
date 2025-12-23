import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'
import { SubscriptionStatus } from '@prisma/client'

/**
 * Проверить подписки, которые истекают через 3 дня, и отправить уведомления
 * Этот endpoint должен вызываться периодически (например, через cron)
 */
export async function POST() {
  try {
    const now = new Date()
    const threeDaysLater = new Date(now)
    threeDaysLater.setDate(threeDaysLater.getDate() + 3)

    // Находим все активные подписки, которые истекают через 3 дня
    const expiringSubscriptions = await prisma.subscription.findMany({
      where: {
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
        },
        currentPeriodEnd: {
          gte: new Date(threeDaysLater.getTime() - 24 * 60 * 60 * 1000), // -1 день для погрешности
          lte: threeDaysLater,
        },
      },
      include: {
        company: {
          include: {
            users: true,
          },
        },
        plan: true,
      },
    })

    let notificationsSent = 0

    for (const subscription of expiringSubscriptions) {
      // Проверяем, не отправляли ли уже уведомление (чтобы не спамить)
      const expiryDate = subscription.currentPeriodEnd
      if (!expiryDate) continue

      // Отправляем уведомление всем пользователям компании
      for (const user of subscription.company.users) {
        // Проверяем, не отправляли ли уже уведомление сегодня
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: user.id,
            title: 'Подписка истекает',
            createdAt: {
              gte: today,
            },
          },
        })

        if (!existingNotification) {
          await createNotification({
            userId: user.id,
            title: 'Подписка истекает',
            message: `Ваша подписка на тариф "${subscription.plan.name}" истекает через 3 дня (${expiryDate.toLocaleDateString('ru-RU')}). Продлите подписку для продолжения работы.`,
            type: 'warning',
          })
          notificationsSent++
        }
      }
    }

    return NextResponse.json({
      success: true,
      expiringSubscriptions: expiringSubscriptions.length,
      notificationsSent,
    })
  } catch (error: any) {
    console.error('[billing][check-expiry][POST]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check subscription expiry' },
      { status: 500 }
    )
  }
}

