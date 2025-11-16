import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";
import { isAdmin } from "@/lib/access-control";

// Получить список всех пользователей компании (только для админа)
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Только админ может видеть список пользователей
    if (!await isAdmin()) {
      return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
    }

    const companyId = parseInt(user.companyId);

    // Получаем всех пользователей компании
    const users = await prisma.user.findMany({
      where: {
        companyId: companyId
      },
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

    // Статистика по компании
    const totalUsers = users.length;
    const adminUsers = users.filter(u => u.role === 'admin').length;
    const regularUsers = users.filter(u => u.role === 'user' || u.role === 'manager').length;

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

