const { PrismaClient, PlanSlug } = require('@prisma/client');

const prisma = new PrismaClient();

const plans = [
  {
    name: 'Lite',
    slug: PlanSlug.LITE,
    description: 'План S: до 5 пользователей, полный функционал без доплат.',
    price: 1500,
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
];

async function main() {
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: 'RUB',
        userLimit: plan.userLimit,
        contactLimit: plan.contactLimit,
        pipelineLimit: plan.pipelineLimit,
        features: plan.features,
      },
      create: {
        ...plan,
        currency: 'RUB',
      },
    });
  }

  console.log('Seeded billing plans');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

