import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";
import { getDirectWhereCondition } from "@/lib/access-control";
import {
  isClosedLostStage,
  isClosedWonStage,
} from "@/lib/dealStages";

/**
 * Получить динамику продаж по периодам
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'month'; // week, month, year
    const groupBy = searchParams.get('groupBy') || 'day'; // day, week, month
    const filterUserId = searchParams.get('userId');
    const pipelineId = searchParams.get('pipelineId');

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

    const baseCondition = { ...whereCondition };

    // Получаем сделки, у которых активность попадает в период (по созданию или обновлению)
    const deals = await prisma.deal.findMany({
      where: {
        ...baseCondition,
        OR: [
          { createdAt: { gte: startDate } },
          { updatedAt: { gte: startDate } },
        ],
      },
      select: {
        id: true,
        amount: true,
        stage: true,
        createdAt: true,
        updatedAt: true,
        expectedCloseDate: true,
        probability: true,
      },
    });

    // Группируем по периодам
    const salesData: Record<string, {
      date: string;
      total: number;
      won: number;
      lost: number;
      active: number;
      wonAmount: number;
      totalAmount: number;
      forecast: number; // Прогноз на основе вероятностей
    }> = {};

    const getDateKey = (date: Date) => {
      const target = new Date(date);
      // Используем локальное время для корректной работы с часовыми поясами
      const year = target.getFullYear();
      const month = String(target.getMonth() + 1).padStart(2, '0');
      const day = String(target.getDate()).padStart(2, '0');
      
      switch (groupBy) {
        case 'week': {
          const weekStart = new Date(target);
          weekStart.setDate(target.getDate() - target.getDay());
          const weekYear = weekStart.getFullYear();
          const weekMonth = String(weekStart.getMonth() + 1).padStart(2, '0');
          const weekDay = String(weekStart.getDate()).padStart(2, '0');
          return `${weekYear}-${weekMonth}-${weekDay}`;
        }
        case 'month':
          return `${year}-${month}`;
        case 'day':
        default:
          return `${year}-${month}-${day}`;
      }
    };

    const ensureBucket = (key: string) => {
      if (!salesData[key]) {
        salesData[key] = {
          date: key,
          total: 0,
          won: 0,
          lost: 0,
          active: 0,
          wonAmount: 0,
          totalAmount: 0,
          forecast: 0,
        };
      }
    };

    deals.forEach(deal => {
      const createdAt = new Date(deal.createdAt);
      const updatedAt = new Date(deal.updatedAt ?? deal.createdAt);

      // Учитываем создание сделки только если оно попадает в период
      if (createdAt >= startDate) {
        const creationKey = getDateKey(createdAt);
        ensureBucket(creationKey);
        salesData[creationKey].total++;
        salesData[creationKey].totalAmount += deal.amount;

        if (!isClosedWonStage(deal.stage) && !isClosedLostStage(deal.stage)) {
          salesData[creationKey].active++;
          salesData[creationKey].forecast += deal.amount * (deal.probability / 100);
        }
      }

      if (isClosedWonStage(deal.stage)) {
        const closeKey = getDateKey(updatedAt);
        ensureBucket(closeKey);
        salesData[closeKey].won++;
        salesData[closeKey].wonAmount += deal.amount;
      } else if (isClosedLostStage(deal.stage)) {
        const closeKey = getDateKey(updatedAt);
        ensureBucket(closeKey);
        salesData[closeKey].lost++;
      }
    });

    // Генерируем все дни в периоде для заполнения пропусков
    const allDays: string[] = [];
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0); // Устанавливаем начало дня
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999); // Устанавливаем конец дня
    
    while (currentDate <= endDate) {
      const dateKey = getDateKey(currentDate);
      if (!allDays.includes(dateKey)) {
        allDays.push(dateKey);
      }
      
      // Переходим к следующему дню
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Создаем полный массив данных со всеми днями
    const result = allDays.map(dateKey => {
      if (salesData[dateKey]) {
        return salesData[dateKey];
      }
      // Если данных нет для этого дня, создаем запись с нулями
      return {
        date: dateKey,
        total: 0,
        won: 0,
        lost: 0,
        active: 0,
        wonAmount: 0,
        totalAmount: 0,
        forecast: 0,
      };
    }).sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      data: result,
      period,
      groupBy,
    });
  } catch (error: any) {
    console.error('Error fetching sales analytics:', error);
    return NextResponse.json({ 
      error: process.env.NODE_ENV === 'development' 
        ? `Error: ${error.message}` 
        : "Internal Server Error"
    }, { status: 500 });
  }
}

