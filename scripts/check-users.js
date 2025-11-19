/**
 * Скрипт для проверки пользователей в базе данных
 */

const { PrismaClient } = require('@prisma/client');
const { config } = require('dotenv');

// Загружаем переменные окружения
config();

console.log('🔍 Проверка пользователей в базе данных...\n');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function checkUsers() {
  try {
    console.log('🔗 Подключение к базе данных...');
    
    // Получаем всех пользователей
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`\n✅ Найдено пользователей: ${users.length}\n`);

    if (users.length === 0) {
      console.log('⚠️ Пользователи не найдены в базе данных');
    } else {
      console.log('📋 Список пользователей:');
      console.log('─'.repeat(80));
      users.forEach((user, index) => {
        console.log(`\n${index + 1}. Пользователь #${user.id}`);
        console.log(`   Имя: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Роль: ${user.role}`);
        console.log(`   Создан: ${user.createdAt.toLocaleString('ru-RU')}`);
      });
      console.log('\n' + '─'.repeat(80));
    }

    // Получаем общую статистику
    const totalUsers = await prisma.user.count();
    console.log(`\n📊 Всего пользователей в базе: ${totalUsers}`);

    return true;
  } catch (error) {
    console.error('❌ Ошибка при проверке пользователей:', error.message);
    if (error.message.includes('postgresql://') || error.message.includes('postgres://')) {
      console.error('\n💡 Проверьте, что:');
      console.error('   1. PostgreSQL запущен');
      console.error('   2. DATABASE_URL в .env файле правильный');
      console.error('   3. База данных crm_db существует');
    }
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers()
  .then((success) => {
    if (success) {
      console.log('\n✅ Проверка завершена успешно');
    }
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  });



