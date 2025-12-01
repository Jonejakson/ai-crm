import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, getUserId } from "@/lib/get-session";
import { validateRequest, createDialogSchema } from "@/lib/validation";

// GET - получить диалоги (все или по contactId) текущего пользователя
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get("contactId");
    
    // Если передан contactId - возвращаем диалоги конкретного контакта пользователя
    if (contactId) {
      // Проверяем, что контакт принадлежит пользователю
      const contact = await prisma.contact.findUnique({
        where: { id: Number(contactId) }
      });

      if (!contact || contact.userId !== parseInt(user.id)) {
        return NextResponse.json({ error: "Contact not found or access denied" }, { status: 404 });
      }

      const dialogs = await prisma.dialog.findMany({
        where: { contactId: Number(contactId) },
        orderBy: { createdAt: "asc" },
      });
      return NextResponse.json(dialogs);
    }
    
    // Если contactId не передан - возвращаем все диалоги пользователя
    const allDialogs = await prisma.dialog.findMany({
      where: {
        contact: {
          userId: parseInt(user.id)
        }
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
    });
    
    return NextResponse.json(allDialogs);
  } catch (error) {
    console.error("Error fetching dialogs:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST - добавить сообщение
export async function POST(req: Request) {
  try {
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json({ error: "Неверный формат данных. Ожидается JSON." }, { status: 400 });
    }

    // Валидация с помощью Zod
    const validation = validateRequest(createDialogSchema, body);
    
    if (validation instanceof NextResponse) {
      return validation; // Возвращаем ошибку валидации
    }
    
    const { message, sender, platform, contactId, externalId } = validation;
    const contactIdNum = contactId;

    // Проверка существования контакта
    let contact;
    try {
      contact = await prisma.contact.findUnique({
        where: { id: contactIdNum }
      });
    } catch (dbError: any) {
      console.error("Database error when finding contact:", dbError);
      return NextResponse.json({ 
        error: "Ошибка при проверке контакта. Проверьте подключение к базе данных." 
      }, { status: 500 });
    }

    if (!contact) {
      return NextResponse.json({ error: `Контакт с ID ${contactIdNum} не найден` }, { status: 404 });
    }

    // Создание диалога
    let newDialog;
    try {
      newDialog = await prisma.dialog.create({
        data: {
          message: message.trim(),
          sender: sender || "user",
          platform: platform || "INTERNAL",
          externalId: externalId || null,
          contactId: contactIdNum,
        },
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });
    } catch (createError: any) {
      console.error("Error creating dialog in database:", createError);
      throw createError; // Передаем ошибку в общий catch блок
    }

    return NextResponse.json(newDialog);
  } catch (error: any) {
    console.error("Error creating dialog:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    });
    
    // Обработка специфичных ошибок Prisma
    if (error.code === 'P2003') {
      return NextResponse.json({ 
        error: "Неверный ID контакта. Убедитесь, что контакт существует." 
      }, { status: 400 });
    }
    
    if (error.code === 'P2002') {
      return NextResponse.json({ 
        error: "Сообщение с таким ID уже существует" 
      }, { status: 409 });
    }
    
    // Если это ошибка валидации Prisma
    if (error.message?.includes('Invalid value')) {
      return NextResponse.json({ 
        error: "Неверные данные. Проверьте формат сообщения." 
      }, { status: 400 });
    }
    
    // Возвращаем более информативное сообщение об ошибке
    const errorMessage = error.message || "Внутренняя ошибка сервера";
    return NextResponse.json({ 
      error: process.env.NODE_ENV === 'development' 
        ? `Ошибка: ${errorMessage}` 
        : "Ошибка при создании сообщения. Попробуйте позже." 
    }, { status: 500 });
  }
}