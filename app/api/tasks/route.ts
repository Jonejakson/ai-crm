import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, getUserId } from "@/lib/get-session";
import { createNotification, checkOverdueTasks } from "@/lib/notifications";

// 🔹 Получить все задачи текущего пользователя
export async function GET() {
  try {
    const user = await getCurrentUser();
    
    const userId = getUserId(user);
    
    if (!userId) {
      console.error('No user or invalid user.id in GET /api/tasks');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tasks = await prisma.task.findMany({
      where: {
        userId: userId
      },
      include: { contact: true },
      orderBy: { id: "desc" },
    });
    return NextResponse.json(tasks);
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return NextResponse.json({ 
      error: process.env.NODE_ENV === 'development' 
        ? `Error: ${error.message}` 
        : "Internal Server Error" 
    }, { status: 500 });
  }
}

// 🔹 Добавить задачу
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    
    // Валидация
    if (!data.title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const userId = getUserId(user);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        contactId: data.contactId ? Number(data.contactId) : null,
        status: data.status || 'pending',
        userId: userId,
      },
    });

    // Создаем уведомление, если задача с дедлайном
    if (task.dueDate) {
      await createNotification({
        userId: userId,
        title: 'Новая задача с дедлайном',
        message: `Создана задача "${task.title}" с дедлайном ${new Date(task.dueDate).toLocaleDateString('ru-RU')}`,
        type: 'info',
        entityType: 'task',
        entityId: task.id
      });
    }

    return NextResponse.json(task);
  } catch (error: any) {
    console.error('Error creating task:', error);
    
    if (error.code === 'P2003') {
      return NextResponse.json({ error: "Invalid contact ID" }, { status: 400 });
    }
    
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// 🔹 Обновить задачу
export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    
    // Валидация
    if (!data.id) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }
    
    if (!data.title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const userId = getUserId(user);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Проверяем, что задача принадлежит пользователю
    const existingTask = await prisma.task.findUnique({
      where: { id: data.id }
    });

    if (!existingTask || existingTask.userId !== userId) {
      return NextResponse.json({ error: "Task not found or access denied" }, { status: 404 });
    }

    const task = await prisma.task.update({
      where: { id: data.id },
      data: {
        title: data.title,
        description: data.description || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: data.status || 'pending',
        contactId: data.contactId ? Number(data.contactId) : null,
      },
    });

    // Проверяем просроченные задачи после обновления
    if (task.userId) {
      await checkOverdueTasks()
    }

    return NextResponse.json(task);
  } catch (error: any) {
    console.error('Error updating task:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// 🔹 Удалить задачу
export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const userId = getUserId(user);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Проверяем, что задача принадлежит пользователю
    const task = await prisma.task.findUnique({
      where: { id: Number(id) }
    });

    if (!task || task.userId !== userId) {
      return NextResponse.json({ error: "Task not found or access denied" }, { status: 404 });
    }

    await prisma.task.delete({
      where: { id: Number(id) }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}