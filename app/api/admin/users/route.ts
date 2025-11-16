import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";

// Получить список всех пользователей (только для авторизованных)
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Получаем всех пользователей
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            contacts: true,
            tasks: true,
            deals: true,
            events: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Общая статистика
    const totalUsers = await prisma.user.count();
    const adminUsers = await prisma.user.count({
      where: { role: 'admin' }
    });
    const regularUsers = await prisma.user.count({
      where: { role: 'user' }
    });

    return NextResponse.json({
      total: totalUsers,
      admins: adminUsers,
      regular: regularUsers,
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt,
        stats: {
          contacts: u._count.contacts,
          tasks: u._count.tasks,
          deals: u._count.deals,
          events: u._count.events,
        }
      }))
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ 
      error: "Internal Server Error",
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}

