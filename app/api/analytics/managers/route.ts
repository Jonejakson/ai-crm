import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";
import { isAdmin } from "@/lib/access-control";

/**
 * Получить отчет по эффективности менеджеров
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Только админ может видеть отчет по менеджерам
    if (!await isAdmin()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
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

    const companyId = parseInt(user.companyId);

    // Получаем всех менеджеров компании
    const managers = await prisma.user.findMany({
      where: {
        companyId,
        role: { in: ['manager', 'user'] },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    // Получаем статистику по каждому менеджеру
    const managersStats = await Promise.all(
      managers.map(async (manager) => {
        const [deals, tasks, contacts, events] = await Promise.all([
          prisma.deal.findMany({
            where: {
              userId: manager.id,
              createdAt: { gte: startDate },
            },
          }),
          prisma.task.findMany({
            where: {
              userId: manager.id,
              createdAt: { gte: startDate },
            },
          }),
          prisma.contact.findMany({
            where: {
              userId: manager.id,
              createdAt: { gte: startDate },
            },
          }),
          prisma.event.findMany({
            where: {
              userId: manager.id,
              createdAt: { gte: startDate },
            },
          }),
        ]);

        const wonDeals = deals.filter(d => d.stage === 'closed_won');
        const lostDeals = deals.filter(d => d.stage === 'closed_lost');
        const activeDeals = deals.filter(d => !d.stage.startsWith('closed_'));

        const wonAmount = wonDeals.reduce((sum, d) => sum + d.amount, 0);
        const totalAmount = deals.reduce((sum, d) => sum + d.amount, 0);

        const completedTasks = tasks.filter(t => t.status === 'completed');
        const overdueTasks = tasks.filter(
          t => t.status === 'pending' && t.dueDate && new Date(t.dueDate) < now
        );

        return {
          manager: {
            id: manager.id,
            name: manager.name,
            email: manager.email,
          },
          deals: {
            total: deals.length,
            active: activeDeals.length,
            won: wonDeals.length,
            lost: lostDeals.length,
            wonAmount,
            totalAmount,
            conversion: deals.length > 0 ? (wonDeals.length / deals.length) * 100 : 0,
            avgDealAmount: deals.length > 0 ? totalAmount / deals.length : 0,
          },
          tasks: {
            total: tasks.length,
            completed: completedTasks.length,
            overdue: overdueTasks.length,
            completionRate: tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0,
          },
          contacts: {
            total: contacts.length,
            withDeals: contacts.filter(c => c.deals.length > 0).length,
          },
          events: {
            total: events.length,
            upcoming: events.filter(e => new Date(e.startDate) > now).length,
          },
        };
      })
    );

    // Сортируем по эффективности (по сумме выигранных сделок)
    managersStats.sort((a, b) => b.deals.wonAmount - a.deals.wonAmount);

    return NextResponse.json({
      managers: managersStats,
      period,
    });
  } catch (error: any) {
    console.error('Error fetching managers analytics:', error);
    return NextResponse.json({ 
      error: process.env.NODE_ENV === 'development' 
        ? `Error: ${error.message}` 
        : "Internal Server Error"
    }, { status: 500 });
  }
}

