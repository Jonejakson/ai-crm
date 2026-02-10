import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'
import { getYooKassaPayment, isYooKassaConfigured } from '@/lib/payment'
import { SubscriptionStatus } from '@prisma/client'
import { calculatePeriodEnd } from '@/lib/invoice-utils'

/**
 * Ручная проверка оплаты в YooKassa.
 * Используется когда webhook не сработал (не настроен, задержка и т.д.).
 * Находит подписки компании со статусом TRIAL и externalSubscriptionId,
 * проверяет статус платежа в YooKassa и активирует при успешной оплате.
 */
export async function POST() {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const companyId = Number(currentUser.companyId)
  if (!companyId || Number.isNaN(companyId) || companyId <= 0) {
    return NextResponse.json({ error: 'Invalid company' }, { status: 400 })
  }

  if (!isYooKassaConfigured()) {
    return NextResponse.json(
      { error: 'Платёжная система не настроена', activated: false },
      { status: 500 }
    )
  }

  try {
    // Ищем подписки, ожидающие оплаты (TRIAL с externalSubscriptionId)
    const pendingSubscriptions = await prisma.subscription.findMany({
      where: {
        companyId,
        status: SubscriptionStatus.TRIAL,
        externalSubscriptionId: { not: null },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    })

    if (pendingSubscriptions.length === 0) {
      return NextResponse.json({
        activated: false,
        message: 'Нет ожидающих оплат',
      })
    }

    const now = new Date()
    let activated = false
    for (const sub of pendingSubscriptions) {
      const paymentId = sub.externalSubscriptionId
      if (!paymentId) continue

      try {
        const payment = await getYooKassaPayment(paymentId)
        if (payment.status !== 'succeeded') continue

        const periodRaw = payment.metadata?.paymentPeriodMonths
        const paymentPeriodMonths = periodRaw ? Number(periodRaw) : 1
        const safePeriod = [1, 3, 6, 12].includes(paymentPeriodMonths)
          ? (paymentPeriodMonths as 1 | 3 | 6 | 12)
          : 1

        // Если есть активная подписка (продление) — продлеваем её и удаляем временную TRIAL
        const activeSubscription = await prisma.subscription.findFirst({
          where: {
            companyId,
            id: { not: sub.id },
            status: SubscriptionStatus.ACTIVE,
            OR: [
              { currentPeriodEnd: null },
              { currentPeriodEnd: { gt: now } },
            ],
          },
          orderBy: { currentPeriodEnd: 'desc' },
        })

        if (activeSubscription) {
          const baseDate =
            activeSubscription.currentPeriodEnd && activeSubscription.currentPeriodEnd > now
              ? activeSubscription.currentPeriodEnd
              : now
          const periodEnd = calculatePeriodEnd(baseDate, safePeriod)
          await prisma.subscription.update({
            where: { id: activeSubscription.id },
            data: { currentPeriodEnd: periodEnd },
          })
          await prisma.subscription.delete({ where: { id: sub.id } })
        } else {
          const baseDate =
            sub.currentPeriodEnd && sub.currentPeriodEnd > now
              ? sub.currentPeriodEnd
              : now
          const periodEnd = calculatePeriodEnd(baseDate, safePeriod)
          await prisma.subscription.update({
            where: { id: sub.id },
            data: {
              status: SubscriptionStatus.ACTIVE,
              currentPeriodEnd: periodEnd,
              trialEndsAt: null,
            },
          })
        }

        activated = true
        break
      } catch (err) {
        console.error('[sync-payment] Error checking payment', paymentId, err)
      }
    }

    return NextResponse.json({
      activated,
      message: activated
        ? 'Подписка успешно активирована'
        : 'Оплата ещё не получена или платеж в обработке',
    })
  } catch (error: any) {
    console.error('[billing][sync-payment]', error)
    return NextResponse.json(
      {
        error: error.message || 'Ошибка при проверке оплаты',
        activated: false,
      },
      { status: 500 }
    )
  }
}
