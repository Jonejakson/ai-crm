import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, getUserId } from "@/lib/get-session";

/**
 * Получить сохраненные фильтры пользователя
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = getUserId(user);
    if (!userId) {
      return NextResponse.json({ error: "Invalid user" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get('entityType') || 'contacts';

    // Пока используем localStorage на клиенте, но можно добавить модель в БД
    // Для простоты вернем пустой массив - фильтры будут храниться в localStorage
    return NextResponse.json([]);
  } catch (error: any) {
    console.error('Error fetching saved filters:', error);
    return NextResponse.json({ 
      error: process.env.NODE_ENV === 'development' 
        ? `Error: ${error.message}` 
        : "Internal Server Error"
    }, { status: 500 });
  }
}

