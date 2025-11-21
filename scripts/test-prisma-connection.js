/**
 * Тестовый скрипт для проверки подключения Prisma к PostgreSQL
 */

const { PrismaClient } = require('@prisma/client');
const { config } = require('dotenv');

// Загружаем переменные окружения
config();

console.log('🔍 Проверка подключения Prisma к PostgreSQL...\n');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL не найден в переменных окружения!');
  console.error('Проверьте файл .env в корне проекта');
  process.exit(1);
}

console.log('✅ DATABASE_URL найден:');
console.log(`   ${databaseUrl.substring(0, 30)}...\n`);

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function testConnection() {
  try {
    console.log('🔗 Попытка подключения к базе данных...');
    
    // Простой запрос для проверки подключения
    const userCount = await prisma.user.count();
    
    console.log('✅ Подключение успешно!');
    console.log(`✅ Пользователей в базе: ${userCount}\n`);
    
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения:', error.message);
    if (error.message.includes('postgresql://') || error.message.includes('postgres://')) {
      console.error('\n💡 Проблема: Prisma не видит правильный DATABASE_URL');
      console.error('   Убедитесь, что в .env файле указан правильный формат:');
      console.error('   DATABASE_URL="postgresql://user:password@host:port/database?schema=public"');
    }
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

testConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  });




