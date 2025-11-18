import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";
import { getDirectWhereCondition } from "@/lib/access-control";

/**
 * Экспорт аналитики в CSV
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'deals'; // deals, tasks, contacts, managers
    const period = searchParams.get('period') || 'month';

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

    const whereCondition = await getDirectWhereCondition();

    let csvContent = '';
    let filename = '';

    switch (type) {
      case 'deals': {
        const deals = await prisma.deal.findMany({
          where: {
            ...whereCondition,
            createdAt: { gte: startDate },
          },
          include: {
            contact: {
              select: {
                name: true,
                email: true,
                company: true,
              },
            },
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        });

        // BOM для UTF-8
        csvContent = '\uFEFF';
        csvContent += 'Название,Клиент,Email,Компания,Менеджер,Сумма,Валюта,Этап,Вероятность,Дата создания,Ожидаемая дата закрытия\n';
        
        for (const deal of deals) {
          csvContent += [
            `"${deal.title}"`,
            `"${deal.contact?.name || ''}"`,
            `"${deal.contact?.email || ''}"`,
            `"${deal.contact?.company || ''}"`,
            `"${deal.user?.name || ''}"`,
            deal.amount,
            deal.currency,
            `"${deal.stage}"`,
            deal.probability,
            new Date(deal.createdAt).toLocaleDateString('ru-RU'),
            deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString('ru-RU') : '',
          ].join(',') + '\n';
        }

        filename = `deals_${period}_${new Date().toISOString().split('T')[0]}.csv`;
        break;
      }

      case 'tasks': {
        const tasks = await prisma.task.findMany({
          where: {
            ...whereCondition,
            createdAt: { gte: startDate },
          },
          include: {
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

        csvContent = '\uFEFF';
        csvContent += 'Название,Описание,Статус,Клиент,Менеджер,Срок выполнения,Дата создания\n';
        
        for (const task of tasks) {
          csvContent += [
            `"${task.title}"`,
            `"${task.description || ''}"`,
            `"${task.status}"`,
            `"${task.contact?.name || ''}"`,
            `"${task.user?.name || ''}"`,
            task.dueDate ? new Date(task.dueDate).toLocaleDateString('ru-RU') : '',
            new Date(task.createdAt).toLocaleDateString('ru-RU'),
          ].join(',') + '\n';
        }

        filename = `tasks_${period}_${new Date().toISOString().split('T')[0]}.csv`;
        break;
      }

      case 'contacts': {
        const contacts = await prisma.contact.findMany({
          where: {
            ...whereCondition,
            createdAt: { gte: startDate },
          },
          include: {
            user: {
              select: {
                name: true,
              },
            },
            deals: {
              select: {
                id: true,
                amount: true,
                stage: true,
              },
            },
          },
        });

        csvContent = '\uFEFF';
        csvContent += 'Имя,Email,Телефон,Компания,Менеджер,Количество сделок,Сумма сделок,Дата создания\n';
        
        for (const contact of contacts) {
          const dealsAmount = contact.deals.reduce((sum, d) => sum + d.amount, 0);
          csvContent += [
            `"${contact.name}"`,
            `"${contact.email || ''}"`,
            `"${contact.phone || ''}"`,
            `"${contact.company || ''}"`,
            `"${contact.user?.name || ''}"`,
            contact.deals.length,
            dealsAmount,
            new Date(contact.createdAt).toLocaleDateString('ru-RU'),
          ].join(',') + '\n';
        }

        filename = `contacts_${period}_${new Date().toISOString().split('T')[0]}.csv`;
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
    }

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting analytics:', error);
    return NextResponse.json({ 
      error: process.env.NODE_ENV === 'development' 
        ? `Error: ${error.message}` 
        : "Internal Server Error"
    }, { status: 500 });
  }
}

