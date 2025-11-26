import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";
import { getDirectWhereCondition } from "@/lib/access-control";
import { isClosedStage } from "@/lib/dealStages";

/**
 * Получить прогноз продаж на основе вероятностей сделок
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

    // Вычисляем даты для периода
    const now = new Date();
    const endDate = new Date();
    
    switch (period) {
      case 'week':
        endDate.setDate(now.getDate() + 7);
        break;
      case 'month':
        endDate.setMonth(now.getMonth() + 1);
        break;
      case 'quarter':
        endDate.setMonth(now.getMonth() + 3);
        break;
      case 'year':
        endDate.setFullYear(now.getFullYear() + 1);
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

    // Получаем сделки и фильтруем закрытые на уровне приложения
    const dealsWithForecast = await prisma.deal.findMany({
      where: {
        ...whereCondition,
        expectedCloseDate: { lte: endDate },
      },
      select: {
        id: true,
        title: true,
        amount: true,
        probability: true,
        expectedCloseDate: true,
        stage: true,
        contact: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    const activeDeals = dealsWithForecast.filter((deal) => !isClosedStage(deal.stage));

    // Вычисляем прогноз
    const forecast = {
      totalDeals: activeDeals.length,
      totalAmount: activeDeals.reduce((sum, d) => sum + d.amount, 0),
      weightedForecast: activeDeals.reduce((sum, d) => sum + (d.amount * d.probability / 100), 0),
      optimisticForecast: activeDeals.reduce((sum, d) => sum + (d.amount * Math.min(d.probability + 20, 100) / 100), 0),
      pessimisticForecast: activeDeals.reduce((sum, d) => sum + (d.amount * Math.max(d.probability - 20, 0) / 100), 0),
      byStage: activeDeals.reduce((acc, deal) => {
        if (!acc[deal.stage]) {
          acc[deal.stage] = {
            count: 0,
            totalAmount: 0,
            forecast: 0,
          };
        }
        acc[deal.stage].count++;
        acc[deal.stage].totalAmount += deal.amount;
        acc[deal.stage].forecast += deal.amount * (deal.probability / 100);
        return acc;
      }, {} as Record<string, { count: number; totalAmount: number; forecast: number }>),
      deals: activeDeals.map(deal => ({
        id: deal.id,
        title: deal.title,
        amount: deal.amount,
        probability: deal.probability,
        forecast: deal.amount * (deal.probability / 100),
        expectedCloseDate: deal.expectedCloseDate,
        stage: deal.stage,
        contact: deal.contact?.name,
        manager: deal.user?.name,
      })),
    };

    // Сортируем сделки по прогнозу (от большего к меньшему)
    forecast.deals.sort((a, b) => b.forecast - a.forecast);

    return NextResponse.json({
      forecast,
      period,
      periodEnd: endDate.toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching forecast:', error);
    return NextResponse.json({ 
      error: process.env.NODE_ENV === 'development' 
        ? `Error: ${error.message}` 
        : "Internal Server Error"
    }, { status: 500 });
  }
}

