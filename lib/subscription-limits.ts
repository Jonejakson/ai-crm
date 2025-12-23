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
 * Проверить, истекла ли подписка
 */
export async function isSubscriptionExpired(companyId: number): Promise<{
  expired: boolean
  subscription: any | null
  daysUntilExpiry?: number
}> {
  const subscription = await getActiveSubscription(companyId)
  
  if (!subscription) {
    return { expired: true, subscription: null }
  }

  // Если статус CANCELED, подписка истекла
  if (subscription.status === SubscriptionStatus.CANCELED) {
    return { expired: true, subscription }
  }

  // Проверяем дату окончания периода
  if (!subscription.currentPeriodEnd) {
    return { expired: true, subscription }
  }

  const now = new Date()
  const periodEnd = new Date(subscription.currentPeriodEnd)
  const expired = periodEnd < now
  const daysUntilExpiry = expired 
    ? 0 
    : Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  return {
    expired,
    subscription,
    daysUntilExpiry: expired ? undefined : daysUntilExpiry,
  }
}

/**
 * Проверить, можно ли создавать новые сущности (контакты, сделки, автоматизации)
 */
export async function canCreateEntities(companyId: number): Promise<{
  allowed: boolean
  message?: string
  subscription?: any
}> {
  const expiryCheck = await isSubscriptionExpired(companyId)
  
  if (expiryCheck.expired) {
    return {
      allowed: false,
      message: 'Подписка закончилась. Продлите подписку для создания новых контактов, сделок и автоматизаций.',
      subscription: expiryCheck.subscription,
    }
  }

  return {
    allowed: true,
    subscription: expiryCheck.subscription,
  }
}

/**
 * Получить план компании (активная подписка или дефолтный Lite)
 */
export async function getCompanyPlan(companyId: number) {
  const expiryCheck = await isSubscriptionExpired(companyId)
  
  // Если подписка истекла, возвращаем null (нельзя использовать план)
  if (expiryCheck.expired) {
    return null
  }

  const subscription = expiryCheck.subscription
  
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
  // Используем DEV_MODE для явного включения режима разработки (работает и в Vercel)
  const isDevMode = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development'
  if (isDevMode) {
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

  const plan = await getCompanyPlan(companyId)
  
  if (!plan) {
    return {
      allowed: true,
      current: 0,
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

  if (plan.dealLimit === null) {
    return {
      allowed: true,
      current: dealCount,
      limit: null,
    }
  }

  const allowed = dealCount < plan.dealLimit

  return {
    allowed,
    current: dealCount,
    limit: plan.dealLimit,
    message: allowed
      ? undefined
      : `Достигнут лимит открытых сделок (${plan.dealLimit.toLocaleString('ru-RU')}). Обновите тариф для добавления большего количества сделок.`,
  }
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

  const plan = await getCompanyPlan(companyId)
  
  if (!plan) {
    console.log('[checkWebFormsAccess] План не найден для companyId:', companyId)
    return { allowed: false, message: 'План не найден' }
  }

  console.log('[checkWebFormsAccess] План компании:', plan.slug, 'companyId:', companyId)

  // Веб-формы доступны только в планах TEAM и PRO
  if (plan.slug === 'LITE') {
    console.log('[checkWebFormsAccess] Доступ запрещен для тарифа LITE')
    return {
      allowed: false,
      message: 'Веб-формы доступны только в тарифах Team и Pro. Обновите тариф для использования этой функции.',
    }
  }

  // Проверяем лимит веб-форм
  const webFormCount = await prisma.webForm.count({
    where: { companyId },
  })

  if (plan.webFormLimit === null) {
    return {
      allowed: true,
      current: webFormCount,
      limit: null,
    }
  }

  const allowed = webFormCount < plan.webFormLimit

  return {
    allowed,
    current: webFormCount,
    limit: plan.webFormLimit,
    message: allowed
      ? undefined
      : `Достигнут лимит веб-форм (${plan.webFormLimit}). Обновите тариф для создания большего количества форм.`,
  }
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

  const plan = await getCompanyPlan(companyId)
  
  if (!plan) {
    console.log('[checkEmailIntegrationsAccess] План не найден для companyId:', companyId)
    return { allowed: false, message: 'План не найден' }
  }

  console.log('[checkEmailIntegrationsAccess] План компании:', plan.slug, 'companyId:', companyId)

  // Email интеграции доступны только в планах TEAM и PRO
  if (plan.slug === 'LITE') {
    console.log('[checkEmailIntegrationsAccess] Доступ запрещен для тарифа LITE')
    return {
      allowed: false,
      message: 'Email интеграции доступны только в тарифах Team и Pro. Обновите тариф для использования этой функции.',
    }
  }

  // Проверяем лимит email интеграций
  const emailIntegrationCount = await prisma.emailIntegration.count({
    where: { companyId },
  })

  if (plan.emailIntegrationLimit === null) {
    return {
      allowed: true,
      current: emailIntegrationCount,
      limit: null,
    }
  }

  const allowed = emailIntegrationCount < plan.emailIntegrationLimit

  return {
    allowed,
    current: emailIntegrationCount,
    limit: plan.emailIntegrationLimit,
    message: allowed
      ? undefined
      : `Достигнут лимит email интеграций (${plan.emailIntegrationLimit}). Обновите тариф для подключения большего количества аккаунтов.`,
  }
}

/**
 * Проверить доступность Telegram/WhatsApp интеграций для плана
 */
export async function checkMessagingIntegrationsAccess(companyId: number): Promise<{
  allowed: boolean
  message?: string
}> {
  // ВАЖНО: Не отключаем проверки в dev режиме для тестирования тарифов
  // const isDevMode = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development'
  // if (isDevMode) {
  //   return { allowed: true }
  // }

  const plan = await getCompanyPlan(companyId)
  
  if (!plan) {
    console.log('[checkMessagingIntegrationsAccess] План не найден для companyId:', companyId)
    return { allowed: false, message: 'План не найден' }
  }

  console.log('[checkMessagingIntegrationsAccess] План компании:', plan.slug, 'companyId:', companyId)

  // Telegram/WhatsApp доступны только в плане PRO
  const allowed = plan.slug === 'PRO'
  
  if (!allowed) {
    console.log('[checkMessagingIntegrationsAccess] Доступ запрещен для тарифа:', plan.slug)
  }

  return {
    allowed,
    message: allowed
      ? undefined
      : 'Telegram и WhatsApp интеграции доступны только в тарифе Pro. Обновите тариф для использования этой функции.',
  }
}

/**
 * Проверить доступность рекламных интеграций для плана
 */
export async function checkAdvertisingIntegrationsAccess(companyId: number): Promise<{
  allowed: boolean
  message?: string
}> {
  // ВАЖНО: Не отключаем проверки в dev режиме для тестирования тарифов
  // const isDevMode = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development'
  // if (isDevMode) {
  //   return { allowed: true }
  // }

  const plan = await getCompanyPlan(companyId)
  
  if (!plan) {
    console.log('[checkAdvertisingIntegrationsAccess] План не найден для companyId:', companyId)
    return { allowed: false, message: 'План не найден' }
  }

  console.log('[checkAdvertisingIntegrationsAccess] План компании:', plan.slug, 'companyId:', companyId)

  // Рекламные интеграции доступны только в плане PRO
  const allowed = plan.slug === 'PRO'
  
  if (!allowed) {
    console.log('[checkAdvertisingIntegrationsAccess] Доступ запрещен для тарифа:', plan.slug)
  }

  return {
    allowed,
    message: allowed
      ? undefined
      : 'Рекламные интеграции (Yandex.Direct, Avito, Google Ads) доступны только в тарифе Pro. Обновите тариф для использования этой функции.',
  }
}

/**
 * Проверить доступность учетных систем для плана
 */
export async function checkAccountingIntegrationsAccess(companyId: number): Promise<{
  allowed: boolean
  message?: string
}> {
  // ВАЖНО: Не отключаем проверки в dev режиме для тестирования тарифов
  // const isDevMode = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development'
  // if (isDevMode) {
  //   return { allowed: true }
  // }

  const plan = await getCompanyPlan(companyId)
  
  if (!plan) {
    console.log('[checkAccountingIntegrationsAccess] План не найден для companyId:', companyId)
    return { allowed: false, message: 'План не найден' }
  }

  console.log('[checkAccountingIntegrationsAccess] План компании:', plan.slug, 'companyId:', companyId)

  // Учетные системы доступны только в плане PRO
  const allowed = plan.slug === 'PRO'
  
  if (!allowed) {
    console.log('[checkAccountingIntegrationsAccess] Доступ запрещен для тарифа:', plan.slug)
  }

  return {
    allowed,
    message: allowed
      ? undefined
      : 'Интеграции с учетными системами (МойСклад, 1С, Bitrix24) доступны только в тарифе Pro. Обновите тариф для использования этой функции.',
  }
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

  const plan = await getCompanyPlan(companyId)
  
  if (!plan) {
    console.log('[checkWebhookAccess] План не найден для companyId:', companyId)
    return { allowed: false, message: 'План не найден' }
  }

  console.log('[checkWebhookAccess] План компании:', plan.slug, 'companyId:', companyId)

  // Webhook API доступен только в планах TEAM и PRO
  if (plan.slug === 'LITE') {
    console.log('[checkWebhookAccess] Доступ запрещен для тарифа LITE')
    return {
      allowed: false,
      message: 'Webhook API доступен только в тарифах Team и Pro. Обновите тариф для использования этой функции.',
    }
  }

  // Проверяем лимит webhook'ов
  const webhookCount = await prisma.webhookIntegration.count({
    where: { companyId },
  })

  if (plan.webhookLimit === null) {
    return {
      allowed: true,
      current: webhookCount,
      limit: null,
    }
  }

  const allowed = webhookCount < plan.webhookLimit

  return {
    allowed,
    current: webhookCount,
    limit: plan.webhookLimit,
    message: allowed
      ? undefined
      : `Достигнут лимит webhook'ов (${plan.webhookLimit}). Обновите тариф для создания большего количества webhook'ов.`,
  }
}

/**
 * Проверить доступность AI Ассистента для плана
 */
export async function checkAIAssistantAccess(companyId: number): Promise<{
  allowed: boolean
  message?: string
}> {
  // ВАЖНО: Не отключаем проверки в dev режиме для тестирования тарифов
  // const isDevMode = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development'
  // if (isDevMode) {
  //   return { allowed: true }
  // }

  const plan = await getCompanyPlan(companyId)
  
  if (!plan) {
    console.log('[checkAIAssistantAccess] План не найден для companyId:', companyId)
    return { allowed: false, message: 'План не найден' }
  }

  console.log('[checkAIAssistantAccess] План компании:', plan.slug, 'companyId:', companyId)

  // AI Ассистент доступен только в плане PRO
  const allowed = plan.slug === 'PRO'
  
  if (!allowed) {
    console.log('[checkAIAssistantAccess] Доступ запрещен для тарифа:', plan.slug)
  }

  return {
    allowed,
    message: allowed
      ? undefined
      : 'AI Ассистент доступен только в тарифе Pro. Обновите тариф для использования этой функции.',
  }
}

/**
 * Проверить доступность миграции данных для плана
 */
export async function checkMigrationAccess(companyId: number): Promise<{
  allowed: boolean
  message?: string
}> {
  // ВАЖНО: Не отключаем проверки в dev режиме для тестирования тарифов
  // const isDevMode = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development'
  // if (isDevMode) {
  //   return { allowed: true }
  // }

  const plan = await getCompanyPlan(companyId)
  
  if (!plan) {
    console.log('[checkMigrationAccess] План не найден для companyId:', companyId)
    return { allowed: false, message: 'План не найден' }
  }

  console.log('[checkMigrationAccess] План компании:', plan.slug, 'companyId:', companyId)

  // Миграция данных доступна только в плане PRO
  const allowed = plan.slug === 'PRO'
  
  if (!allowed) {
    console.log('[checkMigrationAccess] Доступ запрещен для тарифа:', plan.slug)
  }

  return {
    allowed,
    message: allowed
      ? undefined
      : 'Миграция данных из других CRM доступна только в тарифе Pro. Обновите тариф для использования этой функции.',
  }
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

  const plan = await getCompanyPlan(companyId)
  
  if (!plan) {
    return {
      allowed: true,
      current: 0,
      limit: null,
    }
  }

  // Кастомные поля доступны только в планах TEAM и PRO
  if (plan.slug === 'LITE') {
    return {
      allowed: false,
      current: 0,
      limit: null,
      message: 'Кастомные поля доступны только в тарифах Team и Pro. Обновите тариф для использования этой функции.',
    }
  }

  const customFieldCount = await prisma.customField.count({
    where: { companyId },
  })

  if (plan.customFieldLimit === null) {
    return {
      allowed: true,
      current: customFieldCount,
      limit: null,
    }
  }

  const allowed = customFieldCount < plan.customFieldLimit

  return {
    allowed,
    current: customFieldCount,
    limit: plan.customFieldLimit,
    message: allowed
      ? undefined
      : `Достигнут лимит кастомных полей (${plan.customFieldLimit}). Обновите тариф для создания большего количества полей.`,
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

