import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, getUserId } from "@/lib/get-session";
import { getDirectWhereCondition } from "@/lib/access-control";
import { validateRequest, createEventSchema, updateEventSchema } from "@/lib/validation";
import { createNotification } from "@/lib/notifications";
import { checkPermission } from "@/lib/permissions";
import { hasActiveSubscription } from "@/lib/subscription-limits";

// Получить все события (с учетом роли и фильтра по пользователю для админа)
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filterUserId = searchParams.get('userId'); // Параметр фильтрации для админа
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const contactId = searchParams.get('contactId');

    // Если админ передал userId, фильтруем по нему, иначе используем стандартную фильтрацию
    let whereCondition: any;
    
    if (user.role === 'admin' && filterUserId) {
      // Админ может фильтровать по конкретному пользователю
      const targetUserId = parseInt(filterUserId);
      whereCondition = { userId: targetUserId };
    } else {
      // Стандартная фильтрация (менеджер видит свои, админ без фильтра - все компании)
      whereCondition = await getDirectWhereCondition('event');
    }

    // Добавляем дополнительные фильтры
    if (startDate && endDate) {
      whereCondition.startDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    if (contactId) {
      whereCondition.contactId = parseInt(contactId);
    }

    const events = await prisma.event.findMany({
      where: whereCondition,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      },
      orderBy: { startDate: 'asc' },
    });
    
    return NextResponse.json(events);
  } catch (error: any) {
    console.error('Error fetching events:', error);
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

// Создать событие
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    
    const userId = getUserId(user);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canCreate = await checkPermission('events', 'create');
    if (!canCreate) {
      return NextResponse.json({ error: "Нет прав на создание событий" }, { status: 403 });
    }

    if (user.role !== 'owner') {
      const companyId = parseInt(user.companyId);
      const hasSub = await hasActiveSubscription(companyId);
      if (!hasSub) {
        return NextResponse.json(
          { error: "Подписка истекла. Продлите подписку для создания событий." },
          { status: 403 }
        );
      }
    }

    const body = await req.json();
    
    // Валидация с помощью Zod
    const validation = validateRequest(createEventSchema, body);
    
    if (validation instanceof NextResponse) {
      return validation; // Возвращаем ошибку валидации
    }
    
    const data = validation;

    // Если указан контакт, проверяем, что он принадлежит пользователю
    if (data.contactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: Number(data.contactId) }
      });

      if (!contact || contact.userId !== userId) {
        return NextResponse.json({ error: "Contact not found or access denied" }, { status: 404 });
      }
    }

    const event = await prisma.event.create({
      data: {
        title: data.title,
        description: data.description || null,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        location: data.location || null,
        type: data.type || 'meeting',
        contactId: data.contactId ? Number(data.contactId) : null,
        userId: userId,
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        }
      }
    });

    // Создаем уведомление о новом событии
    await createNotification({
      userId: userId,
      title: 'Новое событие',
      message: `Создано событие "${event.title}" на ${new Date(event.startDate).toLocaleString('ru-RU')}`,
      type: 'info',
      entityType: 'event',
      entityId: event.id
    });
    
    return NextResponse.json(event);
  } catch (error: any) {
    console.error('Error creating event:', error);
    
    if (error.code === 'P2003') {
      return NextResponse.json({ error: "Invalid contact ID" }, { status: 400 });
    }
    
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Обновить событие
export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    
    const userId = getUserId(user);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    
    // Валидация с помощью Zod
    const validationResult = validateRequest(updateEventSchema, body);
    
    if (validationResult instanceof NextResponse) {
      return validationResult;
    }
    
    const data = validationResult;

    // Проверяем, что событие принадлежит пользователю
    const existingEvent = await prisma.event.findUnique({
      where: { id: data.id }
    });

    if (!existingEvent || existingEvent.userId !== userId) {
      return NextResponse.json({ error: "Event not found or access denied" }, { status: 404 });
    }

    if (user.role !== 'owner') {
      const companyId = parseInt(user.companyId);
      const hasSub = await hasActiveSubscription(companyId);
      if (!hasSub) {
        return NextResponse.json(
          { error: "Подписка истекла. Продлите подписку для редактирования событий." },
          { status: 403 }
        );
      }
    }

    const event = await prisma.event.update({
      where: { id: data.id },
      data: {
        title: data.title,
        description: data.description !== undefined ? data.description : undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate !== undefined ? (data.endDate ? new Date(data.endDate) : null) : undefined,
        location: data.location !== undefined ? data.location : undefined,
        type: data.type,
        contactId: data.contactId !== undefined ? (data.contactId ? Number(data.contactId) : null) : undefined,
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        }
      }
    });
    
    return NextResponse.json(event);
  } catch (error: any) {
    console.error('Error updating event:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Удалить событие
export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    
    const userId = getUserId(user);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canDelete = await checkPermission('events', 'delete');
    if (!canDelete) {
      return NextResponse.json({ error: "Нет прав на удаление событий" }, { status: 403 });
    }

    if (user.role !== 'owner') {
      const companyId = parseInt(user.companyId);
      const hasSub = await hasActiveSubscription(companyId);
      if (!hasSub) {
        return NextResponse.json(
          { error: "Подписка истекла. Продлите подписку для удаления событий." },
          { status: 403 }
        );
      }
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Проверяем, что событие принадлежит пользователю
    const event = await prisma.event.findUnique({
      where: { id: Number(id) }
    });

    if (!event || event.userId !== userId) {
      return NextResponse.json({ error: "Event not found or access denied" }, { status: 404 });
    }

    await prisma.event.delete({
      where: { id: Number(id) }
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting event:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

