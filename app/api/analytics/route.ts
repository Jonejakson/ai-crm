import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, getUserId } from "@/lib/get-session";
import { getDirectWhereCondition } from "@/lib/access-control";

// Получить аналитику для дашборда (с учетом роли и фильтра по пользователю для админа)
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'month'; // week, month, year
    const filterUserId = searchParams.get('userId'); // Параметр фильтрации для админа

    // Вычисляем даты для периода
    const now = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Если админ передал userId, фильтруем по нему, иначе используем стандартную фильтрацию
    let whereCondition: any;
    
    if (user.role === 'admin' && filterUserId) {
      // Админ может фильтровать по конкретному пользователю
      const targetUserId = parseInt(filterUserId);
      whereCondition = { userId: targetUserId };
    } else {
      // Стандартная фильтрация (менеджер видит свои, админ без фильтра - все компании)
      whereCondition = await getDirectWhereCondition();
    }

    // Получаем данные
    const [contacts, tasks, deals, events] = await Promise.all([
      prisma.contact.findMany({
        where: whereCondition,
        select: {
          id: true,
          createdAt: true,
          deals: {
            select: {
              id: true,
              amount: true,
              stage: true
            }
          }
        }
      }),
      prisma.task.findMany({
        where: whereCondition,
        select: {
          id: true,
          status: true,
          createdAt: true,
          dueDate: true
        }
      }),
      prisma.deal.findMany({
        where: whereCondition,
        select: {
          id: true,
          amount: true,
          currency: true,
          stage: true,
          createdAt: true,
          expectedCloseDate: true
        }
      }),
      prisma.event.findMany({
        where: whereCondition,
        select: {
          id: true,
          type: true,
          startDate: true,
          createdAt: true
        }
      })
    ]);

    // Статистика по контактам
    const contactsStats = {
      total: contacts.length,
      newThisPeriod: contacts.filter(c => new Date(c.createdAt) >= startDate).length,
      withDeals: contacts.filter(c => c.deals.length > 0).length
    };

    // Статистика по задачам
    const tasksStats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue: tasks.filter(t => 
        t.status === 'pending' && 
        t.dueDate && 
        new Date(t.dueDate) < now
      ).length,
      newThisPeriod: tasks.filter(t => new Date(t.createdAt) >= startDate).length
    };

    // Статистика по сделкам
    const dealsStats = {
      total: deals.length,
      active: deals.filter(d => !d.stage.startsWith('closed_')).length,
      won: deals.filter(d => d.stage === 'closed_won').length,
      lost: deals.filter(d => d.stage === 'closed_lost').length,
      totalAmount: deals.reduce((sum, d) => sum + d.amount, 0),
      wonAmount: deals.filter(d => d.stage === 'closed_won').reduce((sum, d) => sum + d.amount, 0),
      lostAmount: deals.filter(d => d.stage === 'closed_lost').reduce((sum, d) => sum + d.amount, 0),
      newThisPeriod: deals.filter(d => new Date(d.createdAt) >= startDate).length,
      byStage: deals.reduce((acc, deal) => {
        acc[deal.stage] = (acc[deal.stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    // Статистика по событиям
    const eventsStats = {
      total: events.length,
      upcoming: events.filter(e => new Date(e.startDate) > now).length,
      past: events.filter(e => new Date(e.startDate) <= now).length,
      byType: events.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      newThisPeriod: events.filter(e => new Date(e.createdAt) >= startDate).length
    };

    // Динамика по дням (для графика)
    const daysData: Record<string, {
      contacts: number;
      tasks: number;
      deals: number;
      events: number;
    }> = {};

    const daysToShow = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    
    // Создаем структуру данных для всех дней периода
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0); // Обнуляем время для точного сравнения
      const dateKey = date.toISOString().split('T')[0];
      daysData[dateKey] = {
        contacts: 0,
        tasks: 0,
        deals: 0,
        events: 0
      };
    }

    // Заполняем данные по дням
    contacts.forEach(contact => {
      const contactDate = new Date(contact.createdAt);
      contactDate.setHours(0, 0, 0, 0);
      const dateKey = contactDate.toISOString().split('T')[0];
      if (daysData[dateKey]) {
        daysData[dateKey].contacts++;
      }
    });

    tasks.forEach(task => {
      const taskDate = new Date(task.createdAt);
      taskDate.setHours(0, 0, 0, 0);
      const dateKey = taskDate.toISOString().split('T')[0];
      if (daysData[dateKey]) {
        daysData[dateKey].tasks++;
      }
    });

    deals.forEach(deal => {
      const dealDate = new Date(deal.createdAt);
      dealDate.setHours(0, 0, 0, 0);
      const dateKey = dealDate.toISOString().split('T')[0];
      if (daysData[dateKey]) {
        daysData[dateKey].deals++;
      }
    });

    events.forEach(event => {
      const eventDate = new Date(event.createdAt);
      eventDate.setHours(0, 0, 0, 0);
      const dateKey = eventDate.toISOString().split('T')[0];
      if (daysData[dateKey]) {
        daysData[dateKey].events++;
      }
    });

    // Конвертируем в массив для графика (от старых к новым)
    const chartData = Object.entries(daysData)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({
        date,
        contacts: data.contacts,
        tasks: data.tasks,
        deals: data.deals,
        events: data.events
      }));
    
    console.log('Chart data:', chartData.slice(0, 5)); // Логируем первые 5 дней для отладки

    return NextResponse.json({
      period,
      contacts: contactsStats,
      tasks: tasksStats,
      deals: dealsStats,
      events: eventsStats,
      chartData
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    return NextResponse.json({ 
      error: process.env.NODE_ENV === 'development' 
        ? `Error: ${error.message}` 
        : "Internal Server Error"
    }, { status: 500 });
  }
}

