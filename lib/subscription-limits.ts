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
    console.log('[getCompanyPlan] Найдена активная подписка:', subscription.plan.slug, 'для companyId:', companyId)
    return subscription.plan
  }

  // Если нет активной подписки, возвращаем дефолтный план Lite
  const defaultPlan = await prisma.plan.findFirst({
    where: { slug: 'LITE' },
  })

  console.log('[getCompanyPlan] Активная подписка не найдена, возвращаем дефолтный план LITE для companyId:', companyId, 'defaultPlan:', defaultPlan?.slug || 'не найден')
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
  // Используем DEV_MODE для явного включения режима разработки (работает и в Vercel)
  const isDevMode = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development'
  if (isDevMode) {
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
  // Используем DEV_MODE для явного включения режима разработки (работает и в Vercel)
  const isDevMode = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development'
  if (isDevMode) {
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

  // Функциональность одинакова на всех тарифах; лимиты по контактам не применяем.
  return { allowed: true, current: contactCount, limit: null }
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
  // Используем DEV_MODE для явного включения режима разработки (работает и в Vercel)
  const isDevMode = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development'
  if (isDevMode) {
    const pipelineCount = await prisma.pipeline.count({
      where: { companyId },
    })
    return {
      allowed: true,
      current: pipelineCount,
      limit: null,
    }
  }

  const pipelineCount = await prisma.pipeline.count({
    where: { companyId },
  })

  // Функциональность одинакова на всех тарифах; лимиты по воронкам не применяем.
  return { allowed: true, current: pipelineCount, limit: null }
}

/**
 * Проверить доступность автоматизаций для плана
 */
export async function checkAutomationsAccess(companyId: number): Promise<{
  allowed: boolean
  message?: string
}> {
  // Бизнес-правило: функциональность одинакова для всех тарифов.
  // Цена зависит только от количества пользователей.
  void companyId
  return { allowed: true }
}

/**
 * Проверить лимит открытых сделок
 */
export async function checkDealLimit(companyId: number): Promise<{
  allowed: boolean
  current: number
  limit: number | null
  message?: string
}> {
  const isDevMode = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development'
  if (isDevMode) {
    const companyUsers = await prisma.user.findMany({
      where: { companyId },
      select: { id: true },
    })
    const userIds = companyUsers.map(u => u.id)
    const dealCount = await prisma.deal.count({
      where: {
        userId: { in: userIds },
        // Считаем только открытые сделки (не на этапе "Закрыто" или "Отменено")
        // Это упрощенная логика, можно улучшить
      },
    })
    return {
      allowed: true,
      current: dealCount,
      limit: null,
    }
  }

  const companyUsers = await prisma.user.findMany({
    where: { companyId },
    select: { id: true },
  })
  const userIds = companyUsers.map(u => u.id)

  const dealCount = await prisma.deal.count({
    where: {
      userId: { in: userIds },
    },
  })

  // Функциональность одинакова на всех тарифах; лимиты по сделкам не применяем.
  return { allowed: true, current: dealCount, limit: null }
}

/**
 * Проверить доступность веб-форм для плана
 */
export async function checkWebFormsAccess(companyId: number): Promise<{
  allowed: boolean
  current?: number
  limit?: number | null
  message?: string
}> {
  // ВАЖНО: Не отключаем проверки в dev режиме для тестирования тарифов
  // const isDevMode = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development'
  // if (isDevMode) {
  //   return { allowed: true }
  // }

  // Функциональность доступна на любом тарифе; лимиты по функциям не применяем.
  const webFormCount = await prisma.webForm.count({
    where: { companyId },
  })
  return { allowed: true, current: webFormCount, limit: null }
}

/**
 * Проверить доступность email интеграций для плана
 */
export async function checkEmailIntegrationsAccess(companyId: number): Promise<{
  allowed: boolean
  current?: number
  limit?: number | null
  message?: string
}> {
  // ВАЖНО: Не отключаем проверки в dev режиме для тестирования тарифов
  // const isDevMode = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development'
  // if (isDevMode) {
  //   return { allowed: true }
  // }

  // Функциональность доступна на любом тарифе; лимиты по функциям не применяем.
  const emailIntegrationCount = await prisma.emailIntegration.count({
    where: { companyId },
  })
  return { allowed: true, current: emailIntegrationCount, limit: null }
}

/**
 * Проверить доступность Telegram/WhatsApp интеграций для плана
 */
export async function checkMessagingIntegrationsAccess(companyId: number): Promise<{
  allowed: boolean
  message?: string
}> {
  // Функциональность доступна на любом тарифе; цена зависит только от количества пользователей.
  void companyId
  return { allowed: true }
}

/**
 * Проверить доступность рекламных интеграций для плана
 */
export async function checkAdvertisingIntegrationsAccess(companyId: number): Promise<{
  allowed: boolean
  message?: string
}> {
  void companyId
  return { allowed: true }
}

/**
 * Проверить доступность учетных систем для плана
 */
export async function checkAccountingIntegrationsAccess(companyId: number): Promise<{
  allowed: boolean
  message?: string
}> {
  void companyId
  return { allowed: true }
}

/**
 * Проверить доступность Webhook API для плана
 */
export async function checkWebhookAccess(companyId: number): Promise<{
  allowed: boolean
  current?: number
  limit?: number | null
  message?: string
}> {
  // ВАЖНО: Не отключаем проверки в dev режиме для тестирования тарифов
  // const isDevMode = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development'
  // if (isDevMode) {
  //   return { allowed: true }
  // }

  // Функциональность доступна на любом тарифе; лимиты по функциям не применяем.
  const webhookCount = await prisma.webhookIntegration.count({
    where: { companyId },
  })
  return { allowed: true, current: webhookCount, limit: null }
}

/**
 * Проверить доступность AI Ассистента для плана
 */
export async function checkAIAssistantAccess(companyId: number): Promise<{
  allowed: boolean
  message?: string
}> {
  void companyId
  return { allowed: true }
}

/**
 * Проверить доступность миграции данных для плана
 */
export async function checkMigrationAccess(companyId: number): Promise<{
  allowed: boolean
  message?: string
}> {
  void companyId
  return { allowed: true }
}

/**
 * Проверить лимит кастомных полей
 */
export async function checkCustomFieldsLimit(companyId: number): Promise<{
  allowed: boolean
  current: number
  limit: number | null
  message?: string
}> {
  const isDevMode = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development'
  if (isDevMode) {
    const customFieldCount = await prisma.customField.count({
      where: { companyId },
    })
    return {
      allowed: true,
      current: customFieldCount,
      limit: null,
    }
  }

  const customFieldCount = await prisma.customField.count({
    where: { companyId },
  })

  // Функциональность одинакова на всех тарифах; лимиты по кастомным полям не применяем.
  return { allowed: true, current: customFieldCount, limit: null }
}

/**
 * Получить информацию об использовании лимитов компании
 */
export async function getCompanyLimitsUsage(companyId: number) {
  const plan = await getCompanyPlan(companyId)
  
  if (!plan) {
    return null
  }

  const [userLimit, contactLimit, pipelineLimit, dealLimit] = await Promise.all([
    checkUserLimit(companyId),
    checkContactLimit(companyId),
    checkPipelineLimit(companyId),
    checkDealLimit(companyId),
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
      deals: dealLimit,
    },
  }
}

