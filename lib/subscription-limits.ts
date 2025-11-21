import prisma from './prisma'
import { SubscriptionStatus } from '@prisma/client'

const ACTIVE_STATUSES = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIAL,
  SubscriptionStatus.PAST_DUE,
]

/**
 * Получить активную подписку компании
 */
export async function getActiveSubscription(companyId: number) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      companyId,
      status: { in: ACTIVE_STATUSES },
    },
    include: {
      plan: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return subscription
}

/**
 * Получить план компании (активная подписка или дефолтный Lite)
 */
export async function getCompanyPlan(companyId: number) {
  const subscription = await getActiveSubscription(companyId)
  
  if (subscription?.plan) {
    return subscription.plan
  }

  // Если нет активной подписки, возвращаем дефолтный план Lite
  const defaultPlan = await prisma.plan.findFirst({
    where: { slug: 'LITE' },
  })

  return defaultPlan
}

/**
 * Проверить лимит пользователей
 */
export async function checkUserLimit(companyId: number): Promise<{
  allowed: boolean
  current: number
  limit: number | null
  message?: string
}> {
  // В режиме разработки отключаем все лимиты
  if (process.env.NODE_ENV === 'development') {
    const userCount = await prisma.user.count({
      where: { companyId },
    })
    return {
      allowed: true,
      current: userCount,
      limit: null,
    }
  }

  const plan = await getCompanyPlan(companyId)
  
  if (!plan) {
    return {
      allowed: true,
      current: 0,
      limit: null,
    }
  }

  const userCount = await prisma.user.count({
    where: { companyId },
  })

  // Если лимит null, значит без ограничений
  if (plan.userLimit === null) {
    return {
      allowed: true,
      current: userCount,
      limit: null,
    }
  }

  const allowed = userCount < plan.userLimit

  return {
    allowed,
    current: userCount,
    limit: plan.userLimit,
    message: allowed
      ? undefined
      : `Достигнут лимит пользователей (${plan.userLimit}). Обновите тариф для добавления большего количества пользователей.`,
  }
}

/**
 * Проверить лимит контактов
 */
export async function checkContactLimit(companyId: number): Promise<{
  allowed: boolean
  current: number
  limit: number | null
  message?: string
}> {
  // В режиме разработки отключаем все лимиты
  if (process.env.NODE_ENV === 'development') {
    const companyUsers = await prisma.user.findMany({
      where: { companyId },
      select: { id: true },
    })
    const userIds = companyUsers.map(u => u.id)
    const contactCount = await prisma.contact.count({
      where: {
        userId: { in: userIds },
      },
    })
    return {
      allowed: true,
      current: contactCount,
      limit: null,
    }
  }

  const plan = await getCompanyPlan(companyId)
  
  if (!plan) {
    return {
      allowed: true,
      current: 0,
      limit: null,
    }
  }

  // Получаем все контакты компании (через пользователей)
  const companyUsers = await prisma.user.findMany({
    where: { companyId },
    select: { id: true },
  })
  const userIds = companyUsers.map(u => u.id)

  const contactCount = await prisma.contact.count({
    where: {
      userId: { in: userIds },
    },
  })

  // Если лимит null, значит без ограничений
  if (plan.contactLimit === null) {
    return {
      allowed: true,
      current: contactCount,
      limit: null,
    }
  }

  const allowed = contactCount < plan.contactLimit

  return {
    allowed,
    current: contactCount,
    limit: plan.contactLimit,
    message: allowed
      ? undefined
      : `Достигнут лимит контактов (${plan.contactLimit.toLocaleString('ru-RU')}). Обновите тариф для добавления большего количества контактов.`,
  }
}

/**
 * Проверить лимит воронок
 */
export async function checkPipelineLimit(companyId: number): Promise<{
  allowed: boolean
  current: number
  limit: number | null
  message?: string
}> {
  // В режиме разработки отключаем все лимиты
  if (process.env.NODE_ENV === 'development') {
    const pipelineCount = await prisma.pipeline.count({
      where: { companyId },
    })
    return {
      allowed: true,
      current: pipelineCount,
      limit: null,
    }
  }

  const plan = await getCompanyPlan(companyId)
  
  if (!plan) {
    return {
      allowed: true,
      current: 0,
      limit: null,
    }
  }

  const pipelineCount = await prisma.pipeline.count({
    where: { companyId },
  })

  // Если лимит null, значит без ограничений
  if (plan.pipelineLimit === null) {
    return {
      allowed: true,
      current: pipelineCount,
      limit: null,
    }
  }

  const allowed = pipelineCount < plan.pipelineLimit

  return {
    allowed,
    current: pipelineCount,
    limit: plan.pipelineLimit,
    message: allowed
      ? undefined
      : `Достигнут лимит воронок (${plan.pipelineLimit}). Обновите тариф для создания большего количества воронок.`,
  }
}

/**
 * Проверить доступность автоматизаций для плана
 */
export async function checkAutomationsAccess(companyId: number): Promise<{
  allowed: boolean
  message?: string
}> {
  // В режиме разработки разрешаем все
  if (process.env.NODE_ENV === 'development') {
    return {
      allowed: true,
    }
  }

  const plan = await getCompanyPlan(companyId)
  
  if (!plan) {
    return { allowed: false, message: 'План не найден' }
  }

  // Автоматизации доступны только в плане PRO
  const allowed = plan.slug === 'PRO'

  return {
    allowed,
    message: allowed
      ? undefined
      : 'Автоматизации доступны только в тарифе Pro. Обновите тариф для использования этой функции.',
  }
}

/**
 * Получить информацию об использовании лимитов компании
 */
export async function getCompanyLimitsUsage(companyId: number) {
  const plan = await getCompanyPlan(companyId)
  
  if (!plan) {
    return null
  }

  const [userLimit, contactLimit, pipelineLimit] = await Promise.all([
    checkUserLimit(companyId),
    checkContactLimit(companyId),
    checkPipelineLimit(companyId),
  ])

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
    },
    limits: {
      users: userLimit,
      contacts: contactLimit,
      pipelines: pipelineLimit,
    },
  }
}

