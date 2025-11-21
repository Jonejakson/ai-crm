/**
 * Скрипт для проверки загрузки переменных окружения
 */

const { config } = require('dotenv');
const path = require('path');

console.log('🔍 Проверка переменных окружения...\n');

// Загружаем .env
const result = config();

if (result.error) {
  console.error('❌ Ошибка загрузки .env:', result.error);
  process.exit(1);
}

console.log('✅ .env файл загружен\n');

// Проверяем DATABASE_URL
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL не найден в переменных окружения!');
  console.error('Проверьте файл .env в корне проекта');
  process.exit(1);
}

console.log('✅ DATABASE_URL найден:');
console.log(`   ${databaseUrl.substring(0, 50)}...\n`);

// Проверяем формат
if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
  console.error('❌ Неверный формат DATABASE_URL!');
  console.error('   Должен начинаться с postgresql:// или postgres://');
  process.exit(1);
}

console.log('✅ Формат DATABASE_URL правильный\n');

// Проверяем подключение к Prisma
try {
  const { PrismaClient } = require('@prisma/client');
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  console.log('✅ Prisma Client создан успешно');
  
  // Пробуем подключиться
  prisma.$connect()
    .then(() => {
      console.log('✅ Подключение к базе данных успешно!\n');
      return prisma.$disconnect();
    })
    .then(() => {
      console.log('✅ Тест завершен успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Ошибка подключения:', error.message);
      process.exit(1);
    });
} catch (error) {
  console.error('❌ Ошибка создания Prisma Client:', error.message);
  process.exit(1);
}




