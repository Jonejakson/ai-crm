import { NextResponse } from "next/server";
import { checkOverdueTasks, checkUpcomingEvents } from "@/lib/notifications";
import { getCurrentUser, getUserId } from "@/lib/get-session";

// Проверка и создание уведомлений (вызывается периодически)
// Может быть вызвана без авторизации для проверки всех пользователей
export async function POST() {
  try {
    const user = await getCurrentUser()
    const userId = getUserId(user)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Проверяем уведомления только для текущего пользователя
    await Promise.all([
      checkOverdueTasks({ userId }),
      checkUpcomingEvents({ userId })
    ]);
    
    return NextResponse.json({ success: true, message: "Notifications checked and created" });
  } catch (error: any) {
    console.error('Error checking notifications:', error);
    return NextResponse.json({ 
      error: process.env.NODE_ENV === 'development' 
        ? `Error: ${error.message}` 
        : "Internal Server Error"
    }, { status: 500 });
  }
}

// GET метод для проверки уведомлений (для совместимости)
export async function GET() {
  try {
    const user = await getCurrentUser()
    const userId = getUserId(user)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await Promise.all([
      checkOverdueTasks({ userId }),
      checkUpcomingEvents({ userId })
    ]);
    
    return NextResponse.json({ success: true, message: "Notifications checked and created" });
  } catch (error: any) {
    console.error('Error checking notifications:', error);
    return NextResponse.json({ 
      error: process.env.NODE_ENV === 'development' 
        ? `Error: ${error.message}` 
        : "Internal Server Error"
    }, { status: 500 });
  }
}

