/**
 * Скрипт для миграции данных из SQLite в PostgreSQL
 * 
 * Использование:
 * 1. Убедитесь, что DATABASE_URL в .env указывает на PostgreSQL
 * 2. Запустите: node scripts/migrate-to-postgresql.js
 */

const { PrismaClient } = require('@prisma/client');
const Database = require('better-sqlite3');
const path = require('path');

const sqliteDb = new Database(path.join(__dirname, '../prisma/dev.db'));
const prisma = new PrismaClient();

async function migrateData() {
  console.log('🚀 Начало миграции данных из SQLite в PostgreSQL...\n');

  try {
    // Миграция пользователей
    console.log('📦 Миграция пользователей...');
    const users = sqliteDb.prepare('SELECT * FROM User').all();
    for (const user of users) {
      try {
        await prisma.user.upsert({
          where: { email: user.email },
          update: {},
          create: {
            id: user.id,
            email: user.email,
            name: user.name,
            password: user.password,
            role: user.role || 'user',
            createdAt: new Date(user.createdAt),
            updatedAt: new Date(user.updatedAt),
          },
        });
      } catch (error) {
        console.error(`Ошибка при миграции пользователя ${user.email}:`, error.message);
      }
    }
    console.log(`✅ Мигрировано пользователей: ${users.length}\n`);

    // Миграция контактов
    console.log('📦 Миграция контактов...');
    const contacts = sqliteDb.prepare('SELECT * FROM Contact').all();
    for (const contact of contacts) {
      try {
        await prisma.contact.create({
          data: {
            id: contact.id,
            name: contact.name,
            email: contact.email,
            phone: contact.phone,
            company: contact.company,
            userId: contact.userId,
            createdAt: new Date(contact.createdAt),
            updatedAt: new Date(contact.updatedAt),
          },
        });
      } catch (error) {
        console.error(`Ошибка при миграции контакта ${contact.id}:`, error.message);
      }
    }
    console.log(`✅ Мигрировано контактов: ${contacts.length}\n`);

    // Миграция задач
    console.log('📦 Миграция задач...');
    const tasks = sqliteDb.prepare('SELECT * FROM Task').all();
    for (const task of tasks) {
      try {
        await prisma.task.create({
          data: {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status || 'pending',
            dueDate: task.dueDate ? new Date(task.dueDate) : null,
            contactId: task.contactId,
            userId: task.userId,
            createdAt: new Date(task.createdAt),
            updatedAt: new Date(task.updatedAt),
          },
        });
      } catch (error) {
        console.error(`Ошибка при миграции задачи ${task.id}:`, error.message);
      }
    }
    console.log(`✅ Мигрировано задач: ${tasks.length}\n`);

    // Миграция диалогов
    console.log('📦 Миграция диалогов...');
    const dialogs = sqliteDb.prepare('SELECT * FROM Dialog').all();
    for (const dialog of dialogs) {
      try {
        await prisma.dialog.create({
          data: {
            id: dialog.id,
            message: dialog.message,
            sender: dialog.sender || 'user',
            contactId: dialog.contactId,
            createdAt: new Date(dialog.createdAt),
          },
        });
      } catch (error) {
        console.error(`Ошибка при миграции диалога ${dialog.id}:`, error.message);
      }
    }
    console.log(`✅ Мигрировано диалогов: ${dialogs.length}\n`);

    // Миграция воронок
    console.log('📦 Миграция воронок...');
    const pipelines = sqliteDb.prepare('SELECT * FROM Pipeline').all();
    for (const pipeline of pipelines) {
      try {
        await prisma.pipeline.create({
          data: {
            id: pipeline.id,
            name: pipeline.name,
            stages: pipeline.stages,
            isDefault: pipeline.isDefault === 1,
            createdAt: new Date(pipeline.createdAt),
            updatedAt: new Date(pipeline.updatedAt),
          },
        });
      } catch (error) {
        console.error(`Ошибка при миграции воронки ${pipeline.id}:`, error.message);
      }
    }
    console.log(`✅ Мигрировано воронок: ${pipelines.length}\n`);

    // Миграция сделок
    console.log('📦 Миграция сделок...');
    const deals = sqliteDb.prepare('SELECT * FROM Deal').all();
    for (const deal of deals) {
      try {
        await prisma.deal.create({
          data: {
            id: deal.id,
            title: deal.title,
            amount: deal.amount || 0,
            currency: deal.currency || 'RUB',
            stage: deal.stage,
            probability: deal.probability || 0,
            expectedCloseDate: deal.expectedCloseDate ? new Date(deal.expectedCloseDate) : null,
            contactId: deal.contactId,
            userId: deal.userId,
            pipelineId: deal.pipelineId,
            createdAt: new Date(deal.createdAt),
            updatedAt: new Date(deal.updatedAt),
          },
        });
      } catch (error) {
        console.error(`Ошибка при миграции сделки ${deal.id}:`, error.message);
      }
    }
    console.log(`✅ Мигрировано сделок: ${deals.length}\n`);

    // Миграция событий
    console.log('📦 Миграция событий...');
    const events = sqliteDb.prepare('SELECT * FROM Event').all();
    for (const event of events) {
      try {
        await prisma.event.create({
          data: {
            id: event.id,
            title: event.title,
            description: event.description,
            startDate: new Date(event.startDate),
            endDate: event.endDate ? new Date(event.endDate) : null,
            location: event.location,
            type: event.type || 'meeting',
            contactId: event.contactId,
            userId: event.userId,
            createdAt: new Date(event.createdAt),
            updatedAt: new Date(event.updatedAt),
          },
        });
      } catch (error) {
        console.error(`Ошибка при миграции события ${event.id}:`, error.message);
      }
    }
    console.log(`✅ Мигрировано событий: ${events.length}\n`);

    // Миграция уведомлений
    console.log('📦 Миграция уведомлений...');
    const notifications = sqliteDb.prepare('SELECT * FROM Notification').all();
    for (const notification of notifications) {
      try {
        await prisma.notification.create({
          data: {
            id: notification.id,
            title: notification.title,
            message: notification.message,
            type: notification.type || 'info',
            entityType: notification.entityType,
            entityId: notification.entityId,
            isRead: notification.isRead === 1,
            userId: notification.userId,
            createdAt: new Date(notification.createdAt),
          },
        });
      } catch (error) {
        console.error(`Ошибка при миграции уведомления ${notification.id}:`, error.message);
      }
    }
    console.log(`✅ Мигрировано уведомлений: ${notifications.length}\n`);

    console.log('🎉 Миграция завершена успешно!');
  } catch (error) {
    console.error('❌ Ошибка при миграции:', error);
    throw error;
  } finally {
    sqliteDb.close();
    await prisma.$disconnect();
  }
}

// Запуск миграции
migrateData()
  .then(() => {
    console.log('\n✅ Все данные успешно мигрированы!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка миграции:', error);
    process.exit(1);
  });


