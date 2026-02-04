import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";
import { getDirectWhereCondition } from "@/lib/access-control";
import {
  isClosedLostStage,
  isClosedStage,
  isClosedWonStage,
} from "@/lib/dealStages";

interface RegressionResult {
  slope: number;
  intercept: number;
}

function linearRegression(points: Array<{ x: number; y: number }>): RegressionResult {
  if (points.length === 0) {
    return { slope: 0, intercept: 0 };
  }
  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  points.forEach(({ x, y }) => {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  });
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
  const intercept = sumY / n - slope * (sumX / n);
  return { slope, intercept };
}

// Получить аналитику для дашборда (с учетом роли и фильтра по пользователю для админа)
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'month'; // week, month, year
    const filterUserId = searchParams.get('userId');

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

    const daysInPeriod = Math.max(1, Math.round((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    let whereContact: any;
    let whereDeal: any;
    
    if (user.role === 'admin' && filterUserId) {
      const targetUserId = parseInt(filterUserId);
      whereContact = whereDeal = { userId: targetUserId };
    } else {
      [whereContact, whereDeal] = await Promise.all([
        getDirectWhereCondition('contact'),
        getDirectWhereCondition('deal'),
      ]);
    }

    const companyUsersPromise = prisma.user.findMany({
      where: {
        companyId: Number(user.companyId),
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const [contacts, tasks, deals, events, companyUsers] = await Promise.all([
      prisma.contact.findMany({
        where: whereContact,
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
        where: whereDeal,
        select: {
          id: true,
          amount: true,
          currency: true,
          stage: true,
          createdAt: true,
          expectedCloseDate: true,
          userId: true,
        }
      }),
      prisma.event.findMany({
        where: whereContact,
        select: {
          id: true,
          type: true,
          startDate: true,
          createdAt: true
        }
      }),
      companyUsersPromise,
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
      active: deals.filter(d => !isClosedStage(d.stage)).length,
      won: deals.filter(d => isClosedWonStage(d.stage)).length,
      lost: deals.filter(d => isClosedLostStage(d.stage)).length,
      totalAmount: deals.reduce((sum, d) => sum + d.amount, 0),
      wonAmount: deals.filter(d => isClosedWonStage(d.stage)).reduce((sum, d) => sum + d.amount, 0),
      lostAmount: deals.filter(d => isClosedLostStage(d.stage)).reduce((sum, d) => sum + d.amount, 0),
      newThisPeriod: deals.filter(d => new Date(d.createdAt) >= startDate).length,
      byStage: deals.reduce((acc, deal) => {
        acc[deal.stage] = (acc[deal.stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

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

    const initialManagerPerformance = companyUsers.reduce((acc, manager) => {
      acc[manager.id] = {
        userId: manager.id,
        name: manager.name,
        email: manager.email,
        totalDeals: 0,
        wonDeals: 0,
        revenue: 0,
      };
      return acc;
    }, {} as Record<number, { userId: number; name: string; email: string; totalDeals: number; wonDeals: number; revenue: number }>);

    const managerPerformance = deals.reduce((acc, deal) => {
      if (!deal.userId) return acc;
      if (!acc[deal.userId]) {
        const manager = companyUsers.find((user) => user.id === deal.userId);
        acc[deal.userId] = {
          userId: deal.userId,
          name: manager?.name || 'Без имени',
          email: manager?.email || '',
          totalDeals: 0,
          wonDeals: 0,
          revenue: 0,
        };
      }
      acc[deal.userId].totalDeals += 1;
      if (isClosedWonStage(deal.stage)) {
        acc[deal.userId].wonDeals += 1;
        acc[deal.userId].revenue += deal.amount;
      }
      return acc;
    }, initialManagerPerformance);

    let managerPerformanceList = Object.values(managerPerformance)
      .map((item) => ({
        ...item,
        conversion: item.totalDeals > 0 ? (item.wonDeals / item.totalDeals) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    if (user.role === 'admin' && filterUserId) {
      const userIdFilter = parseInt(filterUserId);
      managerPerformanceList = managerPerformanceList.filter(item => item.userId === userIdFilter);
    } else {
      managerPerformanceList = managerPerformanceList.slice(0, 8);
    }

    const pipelineSummary = Object.entries(dealsStats.byStage).map(([stage, count]) => {
      const total = dealsStats.total || 1;
      return {
        stage,
        count,
        share: (count / total) * 100,
      };
    });

    const planMultiplier = 1.15;
    const kpi = {
      revenue: {
        plan: Math.round(dealsStats.wonAmount * planMultiplier || 0),
        fact: dealsStats.wonAmount,
      },
      deals: {
        plan: Math.round(dealsStats.total * 1.1),
        fact: dealsStats.total,
      },
      tasks: {
        plan: Math.round(tasksStats.total * 1.05),
        fact: tasksStats.completed,
      },
    };

    // Динамика по дням (для графика)
    const daysData: Record<string, {
      contacts: number;
      tasks: number;
      deals: number;
      events: number;
      wonAmount: number;
    }> = {};

    const daysToShow = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    
    // Создаем структуру данных для всех дней периода (центруем по текущей дате)
    const halfWindow = Math.floor(daysToShow / 2);
    const endDate = new Date(now);
    const startWindow = new Date(now);
    startWindow.setDate(startWindow.getDate() - (daysToShow - halfWindow - 1));
    endDate.setDate(endDate.getDate() + halfWindow);

    const tempDate = new Date(startWindow);
    while (tempDate <= endDate) {
      const current = new Date(tempDate);
      current.setHours(0, 0, 0, 0);
      const dateKey = current.toISOString().split('T')[0];
      daysData[dateKey] = {
        contacts: 0,
        tasks: 0,
        deals: 0,
        events: 0,
        wonAmount: 0,
      };
      tempDate.setDate(tempDate.getDate() + 1);
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
        if (isClosedWonStage(deal.stage)) {
          daysData[dateKey].wonAmount += deal.amount;
        }
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
      .map(([date, data], index) => ({
        date,
        index,
        contacts: data.contacts,
        tasks: data.tasks,
        deals: data.deals,
        events: data.events,
        wonAmount: data.wonAmount,
      }));

    const regressionPoints = chartData
      .filter((point) => point.wonAmount > 0)
      .map((point) => ({ x: point.index, y: point.wonAmount }));

    const { slope, intercept } = linearRegression(regressionPoints);
    const futureDays = 30;
    const projection = Array.from({ length: futureDays }).map((_, idx) => {
      const x = chartData.length + idx;
      const predicted = Math.max(0, slope * x + intercept);
      const date = new Date(now);
      date.setDate(date.getDate() + idx + 1);
      return {
        date: date.toISOString().split('T')[0],
        value: predicted,
      };
    });

    const forecast = {
      trendPerDay: slope,
      next30DaysTotal: Math.round(projection.reduce((sum, item) => sum + item.value, 0)),
      projection,
    };

    return NextResponse.json({
      period,
      contacts: contactsStats,
      tasks: tasksStats,
      deals: dealsStats,
      events: eventsStats,
      chartData,
      managerPerformance: managerPerformanceList,
      pipelineSummary,
      kpi,
      forecast,
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

