import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, getUserId } from "@/lib/get-session";
import { getDirectWhereCondition } from "@/lib/access-control";
import { createNotification, checkOverdueTasks } from "@/lib/notifications";
import { validateRequest, createTaskSchema } from "@/lib/validation";
import { validateRequest, createTaskSchema, updateTaskSchema } from "@/lib/validation";

// 🔹 Получить все задачи (с учетом роли и фильтра по пользователю для админа)
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filterUserId = searchParams.get('userId'); // Параметр фильтрации для админа

    // Если админ передал userId, фильтруем по нему, иначе используем стандартную фильтрацию
    let whereCondition: any;
    
    if (user.role === 'admin' && filterUserId) {
      // Админ может фильтровать по конкретному пользователю
      const targetUserId = parseInt(filterUserId);
      whereCondition = { userId: targetUserId };
    } else {
      // Стандартная фильтрация (менеджер видит свои, админ без фильтра - все компании)
      whereCondition = await getDirectWhereCondition();
    }

    const tasks = await prisma.task.findMany({
      where: whereCondition,
      include: { 
        contact: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      },
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

    const body = await req.json();
    
    // Валидация с помощью Zod
    const validation = validateRequest(createTaskSchema, body);
    
    if (validation instanceof NextResponse) {
      return validation; // Возвращаем ошибку валидации
    }
    
    const data = validation;

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

    const body = await req.json();
    
    // Валидация с помощью Zod
    const validationResult = validateRequest(updateTaskSchema, body);
    
    if (validationResult instanceof NextResponse) {
      return validationResult;
    }
    
    const data = validationResult;

    const userId = getUserId(user);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Проверяем, что задача принадлежит пользователю или компании (для админа)
    const existingTask = await prisma.task.findUnique({
      where: { id: data.id },
      include: {
        user: {
          select: {
            companyId: true
          }
        }
      }
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Для админа проверяем компанию, для обычного пользователя - userId
    if (user.role === 'admin') {
      if (!existingTask.user) {
        return NextResponse.json({ error: "Task has no user" }, { status: 404 });
      }
      const userCompanyId = parseInt(user.companyId);
      const taskCompanyId = existingTask.user.companyId;
      if (taskCompanyId !== userCompanyId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    } else {
      if (existingTask.userId !== userId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
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

    // Проверяем, что задача принадлежит пользователю или компании (для админа)
    const task = await prisma.task.findUnique({
      where: { id: Number(id) },
      include: {
        user: {
          select: {
            companyId: true
          }
        }
      }
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Для админа проверяем компанию, для обычного пользователя - userId
    if (user.role === 'admin') {
      if (!task.user) {
        return NextResponse.json({ error: "Task has no user" }, { status: 404 });
      }
      const userCompanyId = parseInt(user.companyId);
      const taskCompanyId = task.user.companyId;
      if (taskCompanyId !== userCompanyId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    } else {
      if (task.userId !== userId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
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