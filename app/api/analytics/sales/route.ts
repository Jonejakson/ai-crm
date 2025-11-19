import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";
import { getDirectWhereCondition } from "@/lib/access-control";

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

    whereCondition.createdAt = { gte: startDate };

    // Получаем сделки
    const deals = await prisma.deal.findMany({
      where: whereCondition,
      select: {
        id: true,
        amount: true,
        stage: true,
        createdAt: true,
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

    deals.forEach(deal => {
      let dateKey: string;
      const dealDate = new Date(deal.createdAt);
      
      switch (groupBy) {
        case 'day':
          dateKey = dealDate.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(dealDate);
          weekStart.setDate(dealDate.getDate() - dealDate.getDay());
          dateKey = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          dateKey = `${dealDate.getFullYear()}-${String(dealDate.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          dateKey = dealDate.toISOString().split('T')[0];
      }

      if (!salesData[dateKey]) {
        salesData[dateKey] = {
          date: dateKey,
          total: 0,
          won: 0,
          lost: 0,
          active: 0,
          wonAmount: 0,
          totalAmount: 0,
          forecast: 0,
        };
      }

      salesData[dateKey].total++;
      salesData[dateKey].totalAmount += deal.amount;
      
      if (deal.stage === 'closed_won') {
        salesData[dateKey].won++;
        salesData[dateKey].wonAmount += deal.amount;
      } else if (deal.stage === 'closed_lost') {
        salesData[dateKey].lost++;
      } else {
        salesData[dateKey].active++;
        // Прогноз на основе вероятности
        salesData[dateKey].forecast += deal.amount * (deal.probability / 100);
      }
    });

    // Конвертируем в массив и сортируем
    const result = Object.values(salesData).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

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

