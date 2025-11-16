import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, getUserId } from "@/lib/get-session";
import { getDirectWhereCondition } from "@/lib/access-control";

// Получить все сделки (с учетом роли и фильтра по пользователю для админа)
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filterUserId = searchParams.get('userId'); // Параметр фильтрации для админа
    const pipelineId = searchParams.get('pipelineId');
    const stage = searchParams.get('stage');

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

    // Добавляем дополнительные фильтры
    if (pipelineId) {
      whereCondition.pipelineId = parseInt(pipelineId);
    }

    if (stage) {
      whereCondition.stage = stage;
    }

    const deals = await prisma.deal.findMany({
      where: whereCondition,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
          }
        },
        pipeline: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
    });
    
    return NextResponse.json(deals);
  } catch (error: any) {
    console.error('Error fetching deals:', error);
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

// Создать сделку
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    
    if (!data.title || !data.contactId) {
      return NextResponse.json({ error: "Title and contact ID are required" }, { status: 400 });
    }

    const userId = getUserId(user);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Проверяем, что контакт принадлежит пользователю
    const contact = await prisma.contact.findUnique({
      where: { id: Number(data.contactId) }
    });

    if (!contact || contact.userId !== userId) {
      return NextResponse.json({ error: "Contact not found or access denied" }, { status: 404 });
    }

    const deal = await prisma.deal.create({
      data: {
        title: data.title,
        amount: data.amount ? parseFloat(data.amount) : 0,
        currency: data.currency || 'RUB',
        stage: data.stage || 'lead',
        probability: data.probability ? parseInt(data.probability) : 0,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
        contactId: Number(data.contactId),
        userId: userId,
        pipelineId: data.pipelineId ? Number(data.pipelineId) : null,
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
          }
        },
        pipeline: true,
      }
    });
    
    return NextResponse.json(deal);
  } catch (error: any) {
    console.error('Error creating deal:', error);
    
    if (error.code === 'P2003') {
      return NextResponse.json({ error: "Invalid contact or pipeline ID" }, { status: 400 });
    }
    
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Обновить сделку
export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    
    if (!data.id) {
      return NextResponse.json({ error: "Deal ID is required" }, { status: 400 });
    }

    const userId = getUserId(user);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Проверяем, что сделка принадлежит пользователю
    const existingDeal = await prisma.deal.findUnique({
      where: { id: data.id }
    });

    if (!existingDeal || existingDeal.userId !== userId) {
      return NextResponse.json({ error: "Deal not found or access denied" }, { status: 404 });
    }

    const deal = await prisma.deal.update({
      where: { id: data.id },
      data: {
        title: data.title,
        amount: data.amount !== undefined ? parseFloat(data.amount) : undefined,
        currency: data.currency,
        stage: data.stage,
        probability: data.probability !== undefined ? parseInt(data.probability) : undefined,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
        pipelineId: data.pipelineId ? Number(data.pipelineId) : null,
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
          }
        },
        pipeline: true,
      }
    });
    
    return NextResponse.json(deal);
  } catch (error: any) {
    console.error('Error updating deal:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }
    
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Удалить сделку
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

    // Проверяем, что сделка принадлежит пользователю
    const deal = await prisma.deal.findUnique({
      where: { id: Number(id) }
    });

    if (!deal || deal.userId !== userId) {
      return NextResponse.json({ error: "Deal not found or access denied" }, { status: 404 });
    }

    await prisma.deal.delete({
      where: { id: Number(id) }
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting deal:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

