import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";
import { getDirectWhereCondition } from "@/lib/access-control";

/**
 * Получить расширенные фильтры для сущностей
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'all'; // contacts, tasks, deals, events

    const whereCondition = await getDirectWhereCondition();

    const filters: any = {};

    // Фильтры для контактов
    if (type === 'all' || type === 'contacts') {
      const contacts = await prisma.contact.findMany({
        where: whereCondition,
        select: {
          company: true,
        },
      });

      const companies = [...new Set(contacts.map(c => c.company).filter(Boolean))];
      filters.contacts = {
        companies: companies.sort(),
      };
    }

    // Фильтры для задач
    if (type === 'all' || type === 'tasks') {
      const tasks = await prisma.task.findMany({
        where: whereCondition,
        select: {
          status: true,
        },
      });

      const statuses = [...new Set(tasks.map(t => t.status))];
      filters.tasks = {
        statuses: statuses.sort(),
      };
    }

    // Фильтры для сделок
    if (type === 'all' || type === 'deals') {
      const [deals, pipelines] = await Promise.all([
        prisma.deal.findMany({
          where: whereCondition,
          select: {
            stage: true,
            currency: true,
          },
        }),
        prisma.pipeline.findMany({
          where: {
            companyId: parseInt(user.companyId),
          },
        }),
      ]);

      const stages = [...new Set(deals.map(d => d.stage))];
      const currencies = [...new Set(deals.map(d => d.currency))];
      
      filters.deals = {
        stages: stages.sort(),
        currencies: currencies.sort(),
        pipelines: pipelines.map(p => ({
          id: p.id,
          name: p.name,
        })),
      };
    }

    // Фильтры для событий
    if (type === 'all' || type === 'events') {
      const events = await prisma.event.findMany({
        where: whereCondition,
        select: {
          type: true,
        },
      });

      const types = [...new Set(events.map(e => e.type))];
      filters.events = {
        types: types.sort(),
      };
    }

    return NextResponse.json({ filters });
  } catch (error: any) {
    console.error('Error fetching filters:', error);
    return NextResponse.json({ 
      error: process.env.NODE_ENV === 'development' 
        ? `Error: ${error.message}` 
        : "Internal Server Error"
    }, { status: 500 });
  }
}

