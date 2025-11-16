import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, getUserId } from "@/lib/get-session";

// ❶ Получить все контакты текущего пользователя
export async function GET() {
  try {
    const user = await getCurrentUser();
    
    const userId = getUserId(user);
    
    if (!userId) {
      console.error('No user or invalid user.id in GET /api/contacts');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contacts = await prisma.contact.findMany({
      where: {
        userId: userId
      },
      orderBy: { id: "desc" },
    });
    return NextResponse.json(contacts);
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

    const data = await req.json();
    
    // Валидация
    if (!data.name || !data.email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    // Проверка формата email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

        const userId = getUserId(user);
        if (!userId) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const newContact = await prisma.contact.create({
          data: {
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            company: data.company || null,
            userId: userId,
          },
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

    const data = await req.json();
    
    // Валидация
    if (!data.id) {
      return NextResponse.json({ error: "Contact ID is required" }, { status: 400 });
    }
    
    if (!data.name || !data.email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    // Проверка формата email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const userId = getUserId(user);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Проверяем, что контакт принадлежит пользователю
    const contact = await prisma.contact.findUnique({
      where: { id: data.id }
    });

    if (!contact || contact.userId !== userId) {
      return NextResponse.json({ error: "Contact not found or access denied" }, { status: 404 });
    }

    const updated = await prisma.contact.update({
      where: { id: data.id },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        company: data.company || null,
      },
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

    // Проверяем, что контакт принадлежит пользователю
          const userId = getUserId(user);
          if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }

          const contact = await prisma.contact.findUnique({
            where: { id: Number(id) }
          });

          if (!contact || contact.userId !== userId) {
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