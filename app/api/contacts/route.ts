import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, getUserId } from "@/lib/get-session";
import { getDirectWhereCondition } from "@/lib/access-control";
import { validateRequest, createContactSchema } from "@/lib/validation";
import { validateRequest, createContactSchema, updateContactSchema } from "@/lib/validation";
import { checkContactLimit } from "@/lib/subscription-limits";

// ❶ Получить все контакты (с учетом роли и фильтра по пользователю для админа)
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

    try {
      const contacts = await prisma.contact.findMany({
        where: whereCondition,
        orderBy: { id: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          }
        }
      });
      return NextResponse.json(contacts);
    } catch (error: any) {
      console.error('Error in GET /api/contacts:', error);
      // Если ошибка связана с отсутствующим полем position, возвращаем контакты без него
      if (error.message?.includes('position') || error.code === 'P2021') {
        const contacts = await prisma.contact.findMany({
          where: whereCondition,
          orderBy: { id: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            company: true,
            position: true,
            inn: true,
            createdAt: true,
            updatedAt: true,
            userId: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              }
            }
          }
        });
        return NextResponse.json(contacts);
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error fetching contacts:', error);
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

// ❷ Добавить новый контакт
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    
    // Валидация с помощью Zod
    const { validateRequest, createContactSchema } = await import("@/lib/validation");
    const validationResult = validateRequest(createContactSchema, body);
    
    if (validationResult instanceof NextResponse) {
      return validationResult;
    }
    
    const data = validationResult;

    // Проверка формата email (если указан)
    if (data.email && data.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }
    }

    const userId = getUserId(user);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Проверка лимита контактов
    const companyId = parseInt(user.companyId);
    const contactLimitCheck = await checkContactLimit(companyId);
    if (!contactLimitCheck.allowed) {
      return NextResponse.json(
        { 
          error: contactLimitCheck.message || "Достигнут лимит контактов",
          limit: contactLimitCheck.limit,
          current: contactLimitCheck.current,
        },
        { status: 403 }
      );
    }

        const contactData: any = {
          name: data.name,
          email: data.email || null,
          phone: data.phone || null,
          company: data.company || null,
          userId: userId,
        };
        
        if (data.position !== undefined) {
          contactData.position = data.position || null;
        }
        if (data.inn !== undefined) {
          contactData.inn = data.inn || null;
        }
        
        const newContact = await prisma.contact.create({
          data: contactData,
        });
    return NextResponse.json(newContact);
  } catch (error: any) {
    console.error('Error creating contact:', error);
    
    // Обработка ошибок Prisma
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ❸ Обновить контакт
export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    
    // Валидация с помощью Zod
    const validationResult = validateRequest(updateContactSchema, body);
    
    if (validationResult instanceof NextResponse) {
      return validationResult;
    }
    
    const data = validationResult;

    const userId = getUserId(user);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Проверяем доступ к контакту (с учетом роли)
    const whereCondition = await getDirectWhereCondition();
    const contact = await prisma.contact.findFirst({
      where: {
        id: data.id,
        ...whereCondition,
      }
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found or access denied" }, { status: 404 });
    }

    const updateData: any = {
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      company: data.company || null,
    };
    
    if (data.position !== undefined) {
      updateData.position = data.position || null;
    }
    if (data.inn !== undefined) {
      updateData.inn = data.inn || null;
    }
    
    const updated = await prisma.contact.update({
      where: { id: data.id },
      data: updateData,
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating contact:', error);
    
    // Обработка ошибок Prisma
    if (error.code === 'P2025') {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }
    
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ❹ Удалить контакт
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

    // Проверяем доступ к контакту (с учетом роли)
    const whereCondition = await getDirectWhereCondition();
    const contact = await prisma.contact.findFirst({
      where: {
        id: Number(id),
        ...whereCondition,
      }
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found or access denied" }, { status: 404 });
    }

    await prisma.contact.delete({
      where: { id: Number(id) }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting contact:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}