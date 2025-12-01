/**
 * Обертка для API endpoints с логированием и обработкой ошибок
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "./logger";

// Sentry импортируется динамически
let Sentry: any = null;
try {
  Sentry = require("@sentry/nextjs");
} catch (error) {
  // Sentry недоступен - работаем без него
}

interface ApiHandlerOptions {
  requireAuth?: boolean;
  logRequest?: boolean;
}

/**
 * Обертка для API handlers с автоматическим логированием и обработкой ошибок
 */
export function withApiHandler<T = any>(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse<T>>,
  options: ApiHandlerOptions = {}
) {
  const { requireAuth = false, logRequest = true } = options;

  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    const startTime = Date.now();
    const method = req.method;
    const path = req.nextUrl.pathname;
    let requestId: string | undefined;
    let userId: number | undefined;
    let companyId: number | undefined;

    try {
      // Генерируем request ID для трейсинга
      requestId = crypto.randomUUID();

      // Логируем запрос
      if (logRequest) {
        logger.info(`${method} ${path}`, { method, path, requestId });
      }

      // Выполняем handler
      const response = await handler(req, context);

      // Извлекаем метаданные из заголовков ответа (если были установлены)
      const responseUserId = response.headers.get("X-User-Id");
      const responseCompanyId = response.headers.get("X-Company-Id");
      
      if (responseUserId) {
        userId = parseInt(responseUserId);
      }
      if (responseCompanyId) {
        companyId = parseInt(responseCompanyId);
      }

      const duration = Date.now() - startTime;
      const statusCode = response.status;

      // Логируем ответ
      if (logRequest) {
        logger.logRequest(method, path, statusCode, duration, {
          userId,
          companyId,
          requestId,
        });
      }

      // Добавляем заголовки для трейсинга
      response.headers.set("X-Request-Id", requestId);
      response.headers.set("X-Response-Time", `${duration}ms`);

      return response;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const statusCode = error.statusCode || 500;

      // Логируем ошибку
      logger.error(
        `Error in ${method} ${path}: ${error.message}`,
        error,
        {
          method,
          path,
          statusCode,
          duration,
        },
        { userId, companyId, requestId }
      );

      // Отправляем в Sentry (если доступен)
      if (Sentry && (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)) {
        try {
          Sentry.withScope((scope: any) => {
            scope.setTag("method", method);
            scope.setTag("path", path);
            scope.setTag("requestId", requestId || "unknown");
            if (userId) scope.setTag("userId", userId.toString());
            if (companyId) scope.setTag("companyId", companyId.toString());
            scope.setContext("request", {
              method,
              path,
              duration,
            });
            Sentry.captureException(error);
          });
        } catch (sentryError) {
          // Sentry недоступен - просто продолжаем
          console.warn("Sentry unavailable:", sentryError);
        }
      }

      // Возвращаем ошибку
      return NextResponse.json(
        {
          error: error.message || "Internal Server Error",
          requestId,
          ...(process.env.NODE_ENV === "development" && {
            stack: error.stack,
          }),
        },
        { status: statusCode }
      );
    }
  };
}

/**
 * Создать успешный ответ с метаданными
 */
export function createSuccessResponse<T>(
  data: T,
  options?: { userId?: number; companyId?: number }
): NextResponse<T> {
  const response = NextResponse.json(data);
  
  if (options?.userId) {
    response.headers.set("X-User-Id", options.userId.toString());
  }
  if (options?.companyId) {
    response.headers.set("X-Company-Id", options.companyId.toString());
  }
  
  return response;
}

/**
 * Создать ответ с ошибкой
 */
export function createErrorResponse(
  message: string,
  statusCode: number = 500,
  error?: Error
): NextResponse {
  const requestId = crypto.randomUUID();
  
  logger.error(message, error, { statusCode }, { requestId });
  
  return NextResponse.json(
    {
      error: message,
      requestId,
      ...(process.env.NODE_ENV === "development" && error && {
        stack: error.stack,
      }),
    },
    { status: statusCode }
  );
}

