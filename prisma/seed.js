const { PrismaClient, PlanSlug } = require('@prisma/client');

const prisma = new PrismaClient();

const plans = [
  {
    name: 'Lite',
    slug: PlanSlug.LITE,
    description: 'Базовый набор инструментов для небольших команд и фрилансеров.',
    price: 0,
    userLimit: 3,
    contactLimit: 1000,
    pipelineLimit: 1,
    features: {
      highlights: [
        '1 воронка продаж',
        'Базовые контакты и задачи',
        'Ручной импорт и экспорт данных',
        'Email-уведомления',
      ],
      support: 'Поддержка по email',
    },
  },
  {
    name: 'Team',
    slug: PlanSlug.TEAM,
    description: 'Для растущих команд с несколькими менеджерами и воронками.',
    price: 4900,
    userLimit: 15,
    contactLimit: 10000,
    pipelineLimit: 5,
    features: {
      highlights: [
        'Несколько воронок продаж',
        'Интеграции с почтой и календарями',
        'Автоматические задачи и напоминания',
        'Базовые отчёты по менеджерам',
      ],
      support: 'Приоритетная поддержка по email и чату',
    },
  },
  {
    name: 'Pro',
    slug: PlanSlug.PRO,
    description: 'Максимум автоматизации и аналитики для зрелых отделов продаж.',
    price: 11900,
    userLimit: null,
    contactLimit: null,
    pipelineLimit: null,
    features: {
      highlights: [
        'Неограниченное число пользователей и воронок',
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

