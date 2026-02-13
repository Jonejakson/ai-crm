/**
 * Очистка БД до нуля и создание одного кабинета владельца: info@flamecrm.ru
 * Запуск на сервере: cd /opt/flamecrm && docker compose exec -T app node scripts/reset-db-to-owner.js
 * Локально: node scripts/reset-db-to-owner.js (нужен .env с DATABASE_URL)
 */
try { require('dotenv').config() } catch (_) {}
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const OWNER_EMAIL = 'info@flamecrm.ru'
const OWNER_PASSWORD = 'Vergyniya1997@!'
const COMPANY_ID_START = 221325

const prisma = new PrismaClient()

const plans = [
  { name: 'Lite', slug: 'LITE', description: 'План S: до 5 пользователей.', price: 1500, currency: 'RUB', userLimit: 5, contactLimit: 5000, pipelineLimit: 3, features: { highlights: ['До 5 пользователей', 'До 3 воронок', 'До 5 000 контактов'], support: 'Поддержка по email' } },
  { name: 'Team', slug: 'TEAM', description: 'План M: до 15 пользователей.', price: 2500, currency: 'RUB', userLimit: 15, contactLimit: 20000, pipelineLimit: 10, features: { highlights: ['До 15 пользователей', 'До 10 воронок', 'До 20 000 контактов'], support: 'Приоритетная поддержка' } },
  { name: 'Pro', slug: 'PRO', description: 'План L: без ограничений.', price: 4000, currency: 'RUB', userLimit: null, contactLimit: null, pipelineLimit: null, features: { highlights: ['Без ограничений', 'Премиум поддержка'], support: 'Персональный менеджер' } },
]

async function main() {
  console.log('1. Очистка БД (TRUNCATE Company, Plan CASCADE)...')
  await prisma.$executeRawUnsafe('TRUNCATE "Company", "Plan" RESTART IDENTITY CASCADE')
  console.log('2. Установка sequence Company.id = 221324 (следующий id = 221325)...')
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Company"', 'id'), ${COMPANY_ID_START - 1})`)

  console.log('3. Создание тарифов (Plan)...')
  for (const p of plans) {
    await prisma.plan.create({ data: p })
  }

  console.log('4. Создание компании (id будет 221325)...')
  const company = await prisma.company.create({
    data: {
      name: 'Flame CRM',
      isLegalEntity: false,
    },
  })
  if (company.id !== COMPANY_ID_START) {
    console.warn(`Ожидали Company.id = ${COMPANY_ID_START}, получили ${company.id}. Проверьте sequence.`)
  }
  console.log('   Company id:', company.id, company.name)

  console.log('5. Создание пользователя владельца', OWNER_EMAIL, '...')
  const hashedPassword = await bcrypt.hash(OWNER_PASSWORD, 10)
  const user = await prisma.user.create({
    data: {
      email: OWNER_EMAIL,
      name: 'Владелец',
      password: hashedPassword,
      companyId: company.id,
      role: 'admin',
      emailVerifiedAt: new Date(),
    },
  })
  console.log('   User id:', user.id, user.email)

  console.log('Готово. Кабинет владельца:')
  console.log('  URL: https://flamecrm.ru/login')
  console.log('  Email:', OWNER_EMAIL)
  console.log('  Пароль: (установлен)')
  console.log('  Company id:', company.id)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
