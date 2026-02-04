import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";
import { getDirectWhereCondition } from "@/lib/access-control";
import { isClosedWonStage } from "@/lib/dealStages";

/**
 * Получить конверсию по воронкам продаж
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const pipelineId = searchParams.get('pipelineId');
    const period = searchParams.get('period') || 'month';
    const filterUserId = searchParams.get('userId');

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

    const companyId = parseInt(user.companyId);
    
    // Получаем воронки компании
    const pipelines = await prisma.pipeline.findMany({
      where: {
        companyId,
        ...(pipelineId ? { id: parseInt(pipelineId) } : {}),
      },
    });

    // Получаем условия фильтрации
    let whereCondition: any;
    if (user.role === 'admin' && filterUserId) {
      whereCondition = { userId: parseInt(filterUserId) };
    } else {
      whereCondition = await getDirectWhereCondition('deal');
    }

    // Получаем все сделки за период
    const deals = await prisma.deal.findMany({
      where: {
        ...whereCondition,
        createdAt: { gte: startDate },
        ...(pipelineId ? { pipelineId: parseInt(pipelineId) } : {}),
      },
      include: {
        pipeline: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Группируем по воронкам и этапам
    const funnelData: Record<number, {
      pipeline: {
        id: number;
        name: string;
      };
      stages: Record<string, {
        name: string;
        count: number;
        amount: number;
        deals: any[];
      }>;
      total: number;
      won: number;
      conversion: number;
    }> = {};

    for (const pipeline of pipelines) {
      const stages = JSON.parse(pipeline.stages) as Array<{ name: string; color: string }>;
      
      funnelData[pipeline.id] = {
        pipeline: {
          id: pipeline.id,
          name: pipeline.name,
        },
        stages: {},
        total: 0,
        won: 0,
        conversion: 0,
      };

      // Инициализируем этапы
      for (const stage of stages) {
        funnelData[pipeline.id].stages[stage.name] = {
          name: stage.name,
          count: 0,
          amount: 0,
          deals: [],
        };
      }
    }

    // Заполняем данные по сделкам
    for (const deal of deals) {
      if (!deal.pipelineId || !funnelData[deal.pipelineId]) continue;

      const stageName = deal.stage;
      if (funnelData[deal.pipelineId].stages[stageName]) {
        funnelData[deal.pipelineId].stages[stageName].count++;
        funnelData[deal.pipelineId].stages[stageName].amount += deal.amount;
        funnelData[deal.pipelineId].stages[stageName].deals.push(deal);
        funnelData[deal.pipelineId].total++;
      }

      if (isClosedWonStage(deal.stage)) {
        funnelData[deal.pipelineId].won++;
      }
    }

    // Вычисляем конверсию для каждой воронки
    for (const pipelineId in funnelData) {
      const data = funnelData[pipelineId];
      if (data.total > 0) {
        data.conversion = (data.won / data.total) * 100;
      }

      // Вычисляем конверсию между этапами
      const stagesArray = Object.values(data.stages);
      for (let i = 0; i < stagesArray.length - 1; i++) {
        const current = stagesArray[i];
        const next = stagesArray[i + 1];
        if (current.count > 0) {
          (current as any).conversion = (next.count / current.count) * 100;
        }
      }
    }

    return NextResponse.json({
      funnels: Object.values(funnelData),
      period,
    });
  } catch (error: any) {
    console.error('Error fetching funnel analytics:', error);
    return NextResponse.json({ 
      error: process.env.NODE_ENV === 'development' 
        ? `Error: ${error.message}` 
        : "Internal Server Error"
    }, { status: 500 });
  }
}

