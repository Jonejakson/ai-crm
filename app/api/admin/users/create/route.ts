import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";
import { isAdmin } from "@/lib/access-control";
import { checkUserLimit } from "@/lib/subscription-limits";
import { validateRequest, createUserSchema } from "@/lib/validation";

/**
 * Создать пользователя в компании (только для админа)
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Только админ может создавать пользователей
    if (!await isAdmin()) {
      return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
    }

    const rawBody = await req.json();
    const companyId = parseInt(user.companyId);

    // Валидация с помощью Zod
    const validationResult = validateRequest(createUserSchema, { ...rawBody, companyId });
    
    if (validationResult instanceof NextResponse) {
      return validationResult;
    }
    
    const { email, password, name, role = 'manager' } = validationResult;

    // Проверка существования пользователя
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 409 }
      );
    }

    // Проверка лимита пользователей
    const userLimitCheck = await checkUserLimit(companyId);
    if (!userLimitCheck.allowed) {
      return NextResponse.json(
        { 
          error: userLimitCheck.message || "Достигнут лимит пользователей",
          limit: userLimitCheck.limit,
          current: userLimitCheck.current,
        },
        { status: 403 }
      );
    }

    // Хеширование пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создание пользователя в компании админа
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role,
        companyId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        createdAt: true,
      }
    });

    return NextResponse.json(
      { message: "Пользователь успешно создан", user: newUser },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Ошибка при создании пользователя", details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    );
  }
}

