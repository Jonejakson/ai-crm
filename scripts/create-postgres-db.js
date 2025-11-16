/**
 * Скрипт для создания базы данных PostgreSQL через Prisma
 * Использование: node scripts/create-postgres-db.js
 */

const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

async function createDatabase() {
  console.log('🔍 Проверка подключения к PostgreSQL...\n');

  // Проверяем DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ Ошибка: DATABASE_URL не установлен в .env файле');
    console.log('\n📝 Добавьте в .env:');
    console.log('DATABASE_URL="postgresql://postgres:your_password@localhost:5432/postgres?schema=public"');
    process.exit(1);
  }

  // Извлекаем компоненты из URL
  // Поддерживаем различные форматы
  let urlMatch = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  
  // Если не сработало, пробуем без порта (по умолчанию 5432)
  if (!urlMatch) {
    urlMatch = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^\/]+)\/([^?]+)/);
    if (urlMatch) {
      urlMatch = [urlMatch[0], urlMatch[1], urlMatch[2], urlMatch[3], '5432', urlMatch[4]];
    }
  }
  
  if (!urlMatch) {
    console.error('❌ Неверный формат DATABASE_URL');
    console.log('\n📝 Текущий DATABASE_URL:', databaseUrl);
    console.log('\n📝 Правильный формат:');
    console.log('DATABASE_URL="postgresql://username:password@host:port/database?schema=public"');
    console.log('\n💡 Пример для создания базы данных:');
    console.log('DATABASE_URL="postgresql://postgres:your_password@localhost:5432/postgres?schema=public"');
    process.exit(1);
  }

  const [, username, password, host, port, currentDb] = urlMatch;
  const targetDbName = 'crm_db'; // Имя базы данных, которую мы создадим
  const adminUrl = `postgresql://${username}:${password}@${host}:${port}/postgres?schema=public`;
  
  console.log(`📋 Параметры подключения:`);
  console.log(`   Пользователь: ${username}`);
  console.log(`   Хост: ${host}:${port}`);
  console.log(`   Текущая БД: ${currentDb}`);

  console.log(`📦 Создание базы данных: ${targetDbName}`);
  console.log(`🔗 Подключение к: ${host}:${port}\n`);

  try {
    // Создаем Prisma Client с админской базой данных
    const adminPrisma = new PrismaClient({
      datasources: {
        db: {
          url: adminUrl,
        },
      },
    });

    // Проверяем подключение
    await adminPrisma.$connect();
    console.log('✅ Подключение к PostgreSQL установлено\n');

    // Создаем базу данных через SQL
    await adminPrisma.$executeRawUnsafe(
      `CREATE DATABASE "${targetDbName}"`
    );

    console.log(`✅ База данных "${targetDbName}" успешно создана!\n`);
    await adminPrisma.$disconnect();

    console.log('🚀 Теперь можно запустить миграции:');
    console.log('   npm run db:migrate:postgres\n');
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log(`ℹ️  База данных "${targetDbName}" уже существует\n`);
      console.log('🚀 Можно сразу запустить миграции:');
      console.log('   npm run db:migrate:postgres\n');
    } else {
      console.error('❌ Ошибка при создании базы данных:', error.message);
      console.log('\n💡 Альтернативные способы:');
      console.log('1. Используйте pgAdmin (графический интерфейс PostgreSQL)');
      console.log('2. Найдите psql.exe в папке установки PostgreSQL и используйте полный путь');
      console.log('   Например: "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe" -U postgres');
      process.exit(1);
    }
  }
}

createDatabase()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка:', error.message);
    process.exit(1);
  });

