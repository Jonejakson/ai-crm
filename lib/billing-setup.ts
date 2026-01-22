import { BillingInterval, PlanSlug, SubscriptionStatus } from '@prisma/client'

type PrismaLike = {
  plan: {
    upsert: (args: any) => Promise<any>
    count: (args?: any) => Promise<number>
    findFirst: (args: any) => Promise<any | null>
  }
  subscription: {
    findFirst: (args: any) => Promise<any | null>
    create: (args: any) => Promise<any>
  }
}

const DEFAULT_PLANS = [
  {
    name: 'Lite',
    slug: PlanSlug.LITE,
    description: 'План S: до 5 пользователей, полный функционал без доплат.',
    price: 1500,
    currency: 'RUB',
    userLimit: 5,
    contactLimit: 5000,
    pipelineLimit: 3,
    features: {
      highlights: [
        'Полный функционал CRM без ограничений по модулям и скрытых доплат',
        'До 5 пользователей',
        'До 3 воронок продаж',
        'До 5 000 контактов',
        'Импорт/экспорт данных, базовые контакты и задачи',
        'Email-уведомления',
      ],
      support: 'Поддержка по email',
    },
  },
  {
    name: 'Team',
    slug: PlanSlug.TEAM,
    description: 'План M: до 15 пользователей, полный функционал без доплат.',
    price: 2500,
    currency: 'RUB',
    userLimit: 15,
    contactLimit: 20000,
    pipelineLimit: 10,
    features: {
      highlights: [
        'Полный функционал CRM без ограничений по модулям и скрытых доплат',
        'До 15 пользователей',
        'До 10 воронок продаж',
        'До 20 000 контактов',
        'Интеграции с почтой и календарями, автоматические задачи и напоминания',
        'Базовые отчёты по менеджерам',
      ],
      support: 'Приоритетная поддержка по email и чату',
    },
  },
  {
    name: 'Pro',
    slug: PlanSlug.PRO,
    description: 'План L: без ограничений по пользователям и функционалу, премиум поддержка.',
    price: 4000,
    currency: 'RUB',
    userLimit: null,
    contactLimit: null,
    pipelineLimit: null,
    features: {
      highlights: [
        'Полный функционал CRM без ограничений и доплат',
        'Неограниченное число пользователей, воронок и контактов',
        'Автоматизации, webhooks и кастомные поля',
        'Расширенная аналитика и экспорт в BI',
        'Премиальная поддержка и SLA',
      ],
      support: 'Персональный менеджер и чат 24/7',
    },
  },
]

export async function ensureDefaultPlans(prisma: PrismaLike) {
  const existingCount = await prisma.plan.count()
  if (existingCount > 0) {
    return
  }

  for (const plan of DEFAULT_PLANS) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        userLimit: plan.userLimit,
        contactLimit: plan.contactLimit,
        pipelineLimit: plan.pipelineLimit,
        features: plan.features,
      },
      create: plan,
    })
  }
}

export async function ensureTrialOnFirstLogin(prisma: PrismaLike, companyId: number) {
  await ensureDefaultPlans(prisma)

  const existing = await prisma.subscription.findFirst({
    where: {
      companyId,
      status: {
        in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.PAST_DUE],
      },
    },
  })

  if (existing) {
    return
  }

  const litePlan = await prisma.plan.findFirst({
    where: { slug: PlanSlug.LITE },
    select: { id: true },
  })

  if (!litePlan) {
    return
  }

  const now = new Date()
  const trialEnd = new Date(now)
  trialEnd.setDate(trialEnd.getDate() + 14)

  await prisma.subscription.create({
    data: {
      companyId,
      planId: litePlan.id,
      status: SubscriptionStatus.TRIAL,
      billingInterval: BillingInterval.MONTHLY,
      currentPeriodEnd: trialEnd,
      trialEndsAt: trialEnd,
    },
  })
}
