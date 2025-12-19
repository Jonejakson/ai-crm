import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";
import { isAdmin, isOwner } from "@/lib/access-control";

// Получить список всех пользователей компании (для админа) или всех компаний (для owner)
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Только админ или owner может видеть список пользователей
    if (!await isAdmin()) {
      return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
    }

    const isUserOwner = await isOwner();
    const companyId = isUserOwner ? undefined : parseInt(user.companyId);

    // Для owner - все пользователи, для admin - только своей компании
    const users = await prisma.user.findMany({
      where: isUserOwner ? {} : {
        companyId: companyId
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
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

    // Получаем информацию о компаниях для owner
    let usersWithCompany = users;
    if (isUserOwner) {
      const companies = await prisma.company.findMany({
        select: { id: true, name: true }
      });
      const companyMap = new Map(companies.map(c => [c.id, c.name]));
      usersWithCompany = users.map(u => ({
        ...u,
        companyName: companyMap.get(u.companyId) || 'Unknown'
      }));
    }

    // Получаем информацию о компании для админа
    let companyInfo = null;
    if (!isUserOwner && companyId) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true, isLegalEntity: true }
      });
      if (company) {
        companyInfo = {
          name: company.name,
          isLegalEntity: company.isLegalEntity
        };
      }
    }

    // Статистика по компании
    const totalUsers = users.length;
    const adminUsers = users.filter(u => u.role === 'admin').length;
    const regularUsers = users.filter(u => u.role === 'user' || u.role === 'manager').length;

    return NextResponse.json({
      total: totalUsers,
      admins: adminUsers,
      regular: regularUsers,
      isOwner: isUserOwner,
      company: companyInfo,
      users: usersWithCompany.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        companyId: u.companyId,
        companyName: (u as any).companyName,
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

