import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";
import { getDirectWhereCondition } from "@/lib/access-control";

/**
 * Сравнение периодов (например, месяц к месяцу)
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'month'; // week, month, quarter, year
    const filterUserId = searchParams.get('userId');
    const pipelineId = searchParams.get('pipelineId');

    // Вычисляем даты для текущего и предыдущего периода
    const now = new Date();
    const currentStart = new Date();
    const currentEnd = new Date(now);
    const previousStart = new Date();
    const previousEnd = new Date();

    switch (period) {
      case 'week':
        currentStart.setDate(now.getDate() - 7);
        previousStart.setDate(now.getDate() - 14);
        previousEnd.setDate(now.getDate() - 7);
        break;
      case 'month':
        currentStart.setMonth(now.getMonth() - 1);
        previousStart.setMonth(now.getMonth() - 2);
        previousEnd.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        currentStart.setMonth(now.getMonth() - 3);
        previousStart.setMonth(now.getMonth() - 6);
        previousEnd.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        currentStart.setFullYear(now.getFullYear() - 1);
        previousStart.setFullYear(now.getFullYear() - 2);
        previousEnd.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Условия фильтрации
    let whereCondition: any;
    if (user.role === 'admin' && filterUserId) {
      whereCondition = { userId: parseInt(filterUserId) };
    } else {
      whereCondition = await getDirectWhereCondition();
    }

    if (pipelineId) {
      whereCondition.pipelineId = parseInt(pipelineId);
    }

    // Получаем данные для текущего периода
    const [currentDeals, previousDeals, currentTasks, previousTasks, currentContacts, previousContacts] = await Promise.all([
      prisma.deal.findMany({
        where: {
          ...whereCondition,
          createdAt: { gte: currentStart, lte: currentEnd },
        },
      }),
      prisma.deal.findMany({
        where: {
          ...whereCondition,
          createdAt: { gte: previousStart, lte: previousEnd },
        },
      }),
      prisma.task.findMany({
        where: {
          ...whereCondition,
          createdAt: { gte: currentStart, lte: currentEnd },
        },
      }),
      prisma.task.findMany({
        where: {
          ...whereCondition,
          createdAt: { gte: previousStart, lte: previousEnd },
        },
      }),
      prisma.contact.findMany({
        where: {
          ...whereCondition,
          createdAt: { gte: currentStart, lte: currentEnd },
        },
      }),
      prisma.contact.findMany({
        where: {
          ...whereCondition,
          createdAt: { gte: previousStart, lte: previousEnd },
        },
      }),
    ]);

    // Вычисляем статистику
    const calculateDealStats = (deals: any[]) => {
      const won = deals.filter(d => d.stage === 'closed_won');
      const lost = deals.filter(d => d.stage === 'closed_lost');
      return {
        total: deals.length,
        won: won.length,
        lost: lost.length,
        active: deals.filter(d => !d.stage.startsWith('closed_')).length,
        totalAmount: deals.reduce((sum, d) => sum + d.amount, 0),
        wonAmount: won.reduce((sum, d) => sum + d.amount, 0),
        lostAmount: lost.reduce((sum, d) => sum + d.amount, 0),
        conversion: deals.length > 0 ? (won.length / deals.length) * 100 : 0,
      };
    };

    const currentDealStats = calculateDealStats(currentDeals);
    const previousDealStats = calculateDealStats(previousDeals);

    const calculateTaskStats = (tasks: any[]) => {
      const completed = tasks.filter(t => t.status === 'completed');
      return {
        total: tasks.length,
        completed: completed.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        completionRate: tasks.length > 0 ? (completed.length / tasks.length) * 100 : 0,
      };
    };

    const currentTaskStats = calculateTaskStats(currentTasks);
    const previousTaskStats = calculateTaskStats(previousTasks);

    // Вычисляем изменения в процентах
    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const comparison = {
      deals: {
        current: currentDealStats,
        previous: previousDealStats,
        change: {
          total: calculateChange(currentDealStats.total, previousDealStats.total),
          won: calculateChange(currentDealStats.won, previousDealStats.won),
          totalAmount: calculateChange(currentDealStats.totalAmount, previousDealStats.totalAmount),
          wonAmount: calculateChange(currentDealStats.wonAmount, previousDealStats.wonAmount),
          conversion: currentDealStats.conversion - previousDealStats.conversion,
        },
      },
      tasks: {
        current: currentTaskStats,
        previous: previousTaskStats,
        change: {
          total: calculateChange(currentTaskStats.total, previousTaskStats.total),
          completed: calculateChange(currentTaskStats.completed, previousTaskStats.completed),
          completionRate: currentTaskStats.completionRate - previousTaskStats.completionRate,
        },
      },
      contacts: {
        current: currentContacts.length,
        previous: previousContacts.length,
        change: calculateChange(currentContacts.length, previousContacts.length),
      },
      periods: {
        current: {
          start: currentStart.toISOString(),
          end: currentEnd.toISOString(),
        },
        previous: {
          start: previousStart.toISOString(),
          end: previousEnd.toISOString(),
        },
      },
    };

    return NextResponse.json({
      comparison,
      period,
    });
  } catch (error: any) {
    console.error('Error comparing periods:', error);
    return NextResponse.json({ 
      error: process.env.NODE_ENV === 'development' 
        ? `Error: ${error.message}` 
        : "Internal Server Error"
    }, { status: 500 });
  }
}

