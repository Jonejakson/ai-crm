import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * Metrics endpoint
 * Возвращает метрики производительности приложения
 */
export async function GET() {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024), // MB
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024), // MB
        external: Math.round(process.memoryUsage().external / 1024 / 1024), // MB
      },
      database: {
        // Получаем статистику из БД
        connections: 0, // Prisma не предоставляет эту информацию напрямую
      },
      environment: process.env.NODE_ENV || "development",
    };

    // Попытка получить статистику БД
    try {
      const dbStats = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM "User"
      `;
      if (dbStats && dbStats[0]) {
        metrics.database = {
          ...metrics.database,
          usersCount: Number(dbStats[0].count),
        };
      }
    } catch (error) {
      // Игнорируем ошибки получения статистики
    }

    return NextResponse.json(metrics);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to get metrics", message: error.message },
      { status: 500 }
    );
  }
}

