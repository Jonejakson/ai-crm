import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isS3Configured } from "@/lib/storage";

/**
 * Health check endpoint
 * Проверяет состояние приложения и подключение к БД
 */
export async function GET() {
  const startTime = Date.now();
  const health: {
    status: "healthy" | "degraded" | "unhealthy";
    timestamp: string;
    uptime: number;
    checks: {
      database: { status: "ok" | "error"; responseTime?: number; error?: string };
      encryption: { status: "ok" | "error"; error?: string };
      s3: { status: "ok" | "error" | "not_configured"; error?: string };
      memory: { status: "ok" | "warning"; usage?: number; total?: number };
    };
    version: string;
    environment: string;
    metrics?: {
      memoryUsage: number;
      memoryTotal: number;
      cpuUsage?: number;
    };
  } = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: { status: "ok" },
      encryption: { status: "ok" },
      s3: { status: "not_configured" },
      memory: { status: "ok" },
    },
    version: process.env.npm_package_version || "0.1.0",
    environment: process.env.NODE_ENV || "development",
  };

  // Проверка подключения к БД
  try {
    const dbStartTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbResponseTime = Date.now() - dbStartTime;
    
    health.checks.database = {
      status: "ok",
      responseTime: dbResponseTime,
    };
    
    // Если ответ БД слишком медленный, считаем деградированным
    if (dbResponseTime > 1000) {
      health.status = "degraded";
    }
  } catch (error: any) {
    health.checks.database = {
      status: "error",
      error: error.message || "Database connection failed",
    };
    health.status = "unhealthy";
  }

  // Проверка шифрования
  try {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      health.checks.encryption = {
        status: "error",
        error: "ENCRYPTION_KEY is not set",
      };
      health.status = health.status === "unhealthy" ? "unhealthy" : "degraded";
    } else if (encryptionKey.length < 32) {
      health.checks.encryption = {
        status: "error",
        error: "ENCRYPTION_KEY is too short (minimum 32 characters)",
      };
      health.status = health.status === "unhealthy" ? "unhealthy" : "degraded";
    }
  } catch (error: any) {
    health.checks.encryption = {
      status: "error",
      error: error.message || "Encryption check failed",
    };
    health.status = health.status === "unhealthy" ? "unhealthy" : "degraded";
  }

  // Проверка S3 (если настроено)
  try {
    if (isS3Configured()) {
      health.checks.s3 = {
        status: "ok",
      };
    } else {
      health.checks.s3 = {
        status: "not_configured",
      };
    }
  } catch (error: any) {
    health.checks.s3 = {
      status: "error",
      error: error.message || "S3 check failed",
    };
    // S3 не критично, не меняем общий статус
  }

  // Проверка памяти
  try {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal;
    const usedMemory = memUsage.heapUsed;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    health.checks.memory = {
      status: memoryUsagePercent > 90 ? "warning" : "ok",
      usage: Math.round(memoryUsagePercent),
    };

    health.metrics = {
      memoryUsage: Math.round(usedMemory / 1024 / 1024), // MB
      memoryTotal: Math.round(totalMemory / 1024 / 1024), // MB
    };

    // Если память почти закончилась, считаем деградированным
    if (memoryUsagePercent > 95) {
      health.status = health.status === "unhealthy" ? "unhealthy" : "degraded";
    }
  } catch (error: any) {
    health.checks.memory = {
      status: "ok", // Не критично, просто не показываем
    };
  }

  const responseTime = Date.now() - startTime;
  
  // Добавить время ответа в заголовки
  const headers = new Headers();
  headers.set("X-Response-Time", `${responseTime}ms`);
  headers.set("X-Health-Status", health.status);

  // Возвращаем соответствующий статус код
  const statusCode = health.status === "unhealthy" ? 503 : health.status === "degraded" ? 200 : 200;

  return NextResponse.json(health, { status: statusCode, headers });
}
