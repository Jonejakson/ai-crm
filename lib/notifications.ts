import prisma from "./prisma";

interface CreateNotificationParams {
  userId: number;
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'success' | 'error';
  entityType?: 'task' | 'deal' | 'event' | 'contact';
  entityId?: number;
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        title: params.title,
        message: params.message,
        type: params.type || 'info',
        entityType: params.entityType || null,
        entityId: params.entityId || null,
      }
    });
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}

// Создать уведомление о просроченной задаче
export async function checkOverdueTasks() {
  try {
    const now = new Date();
    
    // Находим все просроченные задачи (статус не 'completed')
    const overdueTasks = await prisma.task.findMany({
      where: {
        status: {
          not: 'completed'
        },
        dueDate: {
          not: null,
          lt: now
        }
      },
      include: {
        user: true,
        contact: true
      }
    });

    console.log(`Found ${overdueTasks.length} overdue tasks`);

    for (const task of overdueTasks) {
      if (task.userId && task.dueDate) {
        // Проверяем, нет ли уже уведомления об этой задаче за последние 7 дней
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: task.userId,
            entityType: 'task',
            entityId: task.id,
            title: 'Просроченная задача',
            createdAt: {
              gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // За последние 7 дней
            }
          }
        });

        if (!existingNotification) {
          const dueDate = new Date(task.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          const nowDate = new Date(now);
          nowDate.setHours(0, 0, 0, 0);
          const daysOverdue = Math.floor((nowDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          
          const contactName = task.contact?.name || 'неизвестного контакта';
          
          await createNotification({
            userId: task.userId,
            title: 'Просроченная задача',
            message: `Задача "${task.title}" для ${contactName} просрочена${daysOverdue > 0 ? ` на ${daysOverdue} ${daysOverdue === 1 ? 'день' : daysOverdue < 5 ? 'дня' : 'дней'}` : ''}`,
            type: 'warning',
            entityType: 'task',
            entityId: task.id
          });
          
          console.log(`Created notification for overdue task: ${task.title}, days overdue: ${daysOverdue}`);
        }
      }
    }
  } catch (error) {
    console.error('Error checking overdue tasks:', error);
  }
}

// Создать уведомление о предстоящем событии
export async function checkUpcomingEvents() {
  try {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    
    const upcomingEvents = await prisma.event.findMany({
      where: {
        startDate: {
          gte: now,
          lte: oneHourLater
        }
      },
      include: {
        user: true
      }
    });

    for (const event of upcomingEvents) {
      // Проверяем, нет ли уже уведомления об этом событии
      const existingNotification = await prisma.notification.findFirst({
        where: {
          userId: event.userId,
          entityType: 'event',
          entityId: event.id,
          isRead: false,
          createdAt: {
            gte: new Date(now.getTime() - 60 * 60 * 1000) // За последний час
          }
        }
      });

      if (!existingNotification) {
        await createNotification({
          userId: event.userId,
          title: 'Предстоящее событие',
          message: `Событие "${event.title}" начнется через час`,
          type: 'info',
          entityType: 'event',
          entityId: event.id
        });
      }
    }
  } catch (error) {
    console.error('Error checking upcoming events:', error);
  }
}

