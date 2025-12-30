const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    const email = 'test@flamecrm.ru';
    const password = 'Test123456!';
    const name = 'Тестовый пользователь';
    const role = 'admin';

    console.log('=== Создание тестового пользователя ===');
    console.log(`Email: ${email}`);
    console.log(`Пароль: ${password}`);
    console.log(`Роль: ${role}`);
    console.log('');

    // Генерируем хеш пароля
    const passwordHash = await bcrypt.hash(password, 10);
    console.log('Хеш пароля сгенерирован');

    // Получаем первую компанию
    const company = await prisma.company.findFirst();
    if (!company) {
      console.error('ОШИБКА: Не найдена компания в БД');
      process.exit(1);
    }

    console.log(`Найдена компания с ID: ${company.id}`);

    // Проверяем, существует ли пользователь
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log(`⚠️  Пользователь с email ${email} уже существует (ID: ${existingUser.id})`);
      console.log('Обновление данных...');

      await prisma.user.update({
        where: { email },
        data: {
          password: passwordHash,
          name,
          role,
        },
      });

      console.log('✅ Данные пользователя обновлены!');
    } else {
      console.log('Создание нового пользователя...');

      const user = await prisma.user.create({
        data: {
          email,
          name,
          password: passwordHash,
          role,
          companyId: company.id,
        },
      });

      console.log(`✅ Тестовый пользователь создан успешно! (ID: ${user.id})`);
    }

    console.log('');
    console.log('=== Данные для входа ===');
    console.log(`Email: ${email}`);
    console.log(`Пароль: ${password}`);
    console.log(`Роль: ${role}`);
    console.log('');
    console.log('Ссылка для входа: https://flamecrm.ru/login');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('ОШИБКА:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

