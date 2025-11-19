const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('🔍 Проверка подключения к базе данных...\n');
    
    const userCount = await prisma.user.count();
    console.log(`✅ Пользователей в базе: ${userCount}`);
    
    const contactCount = await prisma.contact.count();
    console.log(`✅ Контактов в базе: ${contactCount}`);
    
    const taskCount = await prisma.task.count();
    console.log(`✅ Задач в базе: ${taskCount}`);
    
    const dealCount = await prisma.deal.count();
    console.log(`✅ Сделок в базе: ${dealCount}\n`);
    
    if (userCount === 0) {
      console.log('⚠️  В базе данных нет пользователей!');
      console.log('💡 Нужно зарегистрировать первого пользователя через /login');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при проверке базы данных:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();



