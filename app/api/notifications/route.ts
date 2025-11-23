import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, getUserId } from "@/lib/get-session";

// Получить все уведомления текущего пользователя
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    const userId = getUserId(user);
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const where: any = {
      userId: userId
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    
    return NextResponse.json(notifications);
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ 
      error: process.env.NODE_ENV === 'development' 
        ? `Error: ${error.message}` 
        : "Internal Server Error"
    }, { status: 500 });
  }
}

// Отметить уведомление как прочитанное
export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    
    const userId = getUserId(user);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    
    if (!data.id) {
      return NextResponse.json({ error: "Notification ID is required" }, { status: 400 });
    }

    // Проверяем, что уведомление принадлежит пользователю
    const notification = await prisma.notification.findUnique({
      where: { id: data.id }
    });

    if (!notification || notification.userId !== userId) {
      return NextResponse.json({ error: "Notification not found or access denied" }, { status: 404 });
    }

    const updated = await prisma.notification.update({
      where: { id: data.id },
      data: {
        isRead: true
      }
    });
    
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating notification:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Отметить все уведомления как прочитанные
export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    
    const userId = getUserId(user);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.notification.updateMany({
      where: {
        userId: userId,
        isRead: false
      },
      data: {
        isRead: true
      }
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error marking all notifications as read:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Удалить уведомление
export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    
    const userId = getUserId(user);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Проверяем, что уведомление принадлежит пользователю
    const notification = await prisma.notification.findUnique({
      where: { id: Number(id) }
    });

    if (!notification || notification.userId !== userId) {
      return NextResponse.json({ error: "Notification not found or access denied" }, { status: 404 });
    }

    await prisma.notification.delete({
      where: { id: Number(id) }
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting notification:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}






