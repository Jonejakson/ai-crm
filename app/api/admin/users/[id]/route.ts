import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";
import { isAdmin } from "@/lib/access-control";

/**
 * Обновить пользователя (только для админа)
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Только админ может обновлять пользователей
    if (!await isAdmin()) {
      return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id);
    const { name, email, role, password } = await req.json();
    const adminCompanyId = parseInt(user.companyId);

    // Проверяем, что пользователь существует и принадлежит той же компании
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true }
    });

    if (!existingUser) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    if (existingUser.companyId !== adminCompanyId) {
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    // Валидация роли
    if (role && !['user', 'manager', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: "Недопустимая роль. Допустимые: user, manager, admin" },
        { status: 400 }
      );
    }

    // Проверка email на уникальность (если изменяется)
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email }
      });

      if (emailExists) {
        return NextResponse.json(
          { error: "Пользователь с таким email уже существует" },
          { status: 409 }
        );
      }
    }

    // Валидация пароля (если изменяется)
    if (password && password.length < 6) {
      return NextResponse.json(
        { error: "Пароль должен быть не менее 6 символов" },
        { status: 400 }
      );
    }

    // Подготовка данных для обновления
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Обновление пользователя
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
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
      { message: "Пользователь успешно обновлен", user: updatedUser },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Ошибка при обновлении пользователя", details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    );
  }
}

/**
 * Удалить пользователя (только для админа)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Только админ может удалять пользователей
    if (!await isAdmin()) {
      return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id);
    const adminCompanyId = parseInt(user.companyId);

    // Проверяем, что пользователь существует и принадлежит той же компании
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true }
    });

    if (!existingUser) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    if (existingUser.companyId !== adminCompanyId) {
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    // Нельзя удалить самого себя
    if (existingUser.id === parseInt(user.id)) {
      return NextResponse.json(
        { error: "Нельзя удалить самого себя" },
        { status: 400 }
      );
    }

    // Удаление пользователя
    await prisma.user.delete({
      where: { id: userId }
    });

    return NextResponse.json(
      { message: "Пользователь успешно удален" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Ошибка при удалении пользователя", details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    );
  }
}

