import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, getUserId } from "@/lib/get-session";
import { getDirectWhereCondition } from "@/lib/access-control";
import { validateRequest, updateTaskSchema } from "@/lib/validation";
import { z } from "zod";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const taskId = parseInt(id);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    const rawBody = await req.json();
    
    // Валидация с помощью Zod (частичное обновление)
    const partialSchema = updateTaskSchema.partial().extend({ id: z.number().int().positive() })
    const validationResult = validateRequest(partialSchema, { ...rawBody, id: taskId })
    
    if (validationResult instanceof NextResponse) {
      return validationResult
    }
    
    const data = validationResult;
    
    // Проверяем, что задача существует и принадлежит пользователю или компании
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
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

    // Проверяем права доступа
    const userId = getUserId(user);
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

    // Обновляем только переданные поля
    const updateData: any = {};
    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.title !== undefined) {
      updateData.title = data.title;
    }
    if (data.description !== undefined) {
      updateData.description = data.description || null;
    }
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }
    if (data.contactId !== undefined) {
      updateData.contactId = data.contactId ? Number(data.contactId) : null;
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
    });

    return NextResponse.json(task);
  } catch (error: any) {
    console.error('Error updating task:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    
    return NextResponse.json({ 
      error: process.env.NODE_ENV === 'development' 
        ? `Error: ${error.message}` 
        : "Internal Server Error" 
    }, { status: 500 });
  }
}

