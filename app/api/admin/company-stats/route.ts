import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";
import { isAdmin } from "@/lib/access-control";
import {
  isClosedLostStage,
  isClosedStage,
  isClosedWonStage,
} from "@/lib/dealStages";

/**
 * Получить статистику всей компании (только для админа)
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Только админ может видеть статистику компании
    if (!await isAdmin()) {
      return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
    }

    const companyId = parseInt(user.companyId);

    // Получаем всех пользователей компании
    const companyUsers = await prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      }
    });

    // Получаем все данные компании
    const [contacts, tasks, deals, events, pipelines] = await Promise.all([
      // Контакты всех пользователей компании
      prisma.contact.findMany({
        where: {
          user: {
            companyId,
          }
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      }),
      // Задачи всех пользователей компании
      prisma.task.findMany({
        where: {
          user: {
            companyId,
          }
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      }),
      // Сделки всех пользователей компании
      prisma.deal.findMany({
        where: {
          user: {
            companyId,
          }
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            }
          },
          contact: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      }),
      // События всех пользователей компании
      prisma.event.findMany({
        where: {
          user: {
            companyId,
          }
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      }),
      // Воронки компании
      prisma.pipeline.findMany({
        where: { companyId },
      })
    ]);

    // Статистика по пользователям
    const usersStats = {
      total: companyUsers.length,
      admins: companyUsers.filter(u => u.role === 'admin').length,
      managers: companyUsers.filter(u => u.role === 'manager').length,
      regular: companyUsers.filter(u => u.role === 'user').length,
      users: companyUsers,
    };

    // Статистика по контактам
    const contactsStats = {
      total: contacts.length,
      byUser: companyUsers.map(u => ({
        userId: u.id,
        userName: u.name,
        count: contacts.filter(c => c.userId === u.id).length,
      })),
    };

    // Статистика по задачам
    const tasksStats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      byUser: companyUsers.map(u => ({
        userId: u.id,
        userName: u.name,
        total: tasks.filter(t => t.userId === u.id).length,
        pending: tasks.filter(t => t.userId === u.id && t.status === 'pending').length,
        completed: tasks.filter(t => t.userId === u.id && t.status === 'completed').length,
      })),
    };

    // Статистика по сделкам
    const dealsStats = {
      total: deals.length,
      totalAmount: deals.reduce((sum, d) => sum + d.amount, 0),
      active: deals.filter(d => !isClosedStage(d.stage)).length,
      won: deals.filter(d => isClosedWonStage(d.stage)).length,
      lost: deals.filter(d => isClosedLostStage(d.stage)).length,
      wonAmount: deals.filter(d => isClosedWonStage(d.stage)).reduce((sum, d) => sum + d.amount, 0),
      byUser: companyUsers.map(u => ({
        userId: u.id,
        userName: u.name,
        total: deals.filter(d => d.userId === u.id).length,
        totalAmount: deals.filter(d => d.userId === u.id).reduce((sum, d) => sum + d.amount, 0),
        active: deals.filter(d => d.userId === u.id && !isClosedStage(d.stage)).length,
      })),
      byStage: deals.reduce((acc, deal) => {
        acc[deal.stage] = (acc[deal.stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    // Статистика по событиям
    const eventsStats = {
      total: events.length,
      upcoming: events.filter(e => new Date(e.startDate) > new Date()).length,
      past: events.filter(e => new Date(e.startDate) <= new Date()).length,
      byUser: companyUsers.map(u => ({
        userId: u.id,
        userName: u.name,
        total: events.filter(e => e.userId === u.id).length,
        upcoming: events.filter(e => e.userId === u.id && new Date(e.startDate) > new Date()).length,
      })),
      byType: events.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return NextResponse.json({
      company: {
        id: companyId,
        name: (await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }))?.name || 'Unknown',
      },
      users: usersStats,
      contacts: contactsStats,
      tasks: tasksStats,
      deals: dealsStats,
      events: eventsStats,
      pipelines: {
        total: pipelines.length,
        pipelines: pipelines,
      },
    });
  } catch (error: any) {
    console.error('Error fetching company stats:', error);
    return NextResponse.json({ 
      error: "Internal Server Error",
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}

