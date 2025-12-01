/**
 * Централизованная обработка ошибок
 * Унифицированные классы ошибок и обработчики
 */

import { NextResponse } from "next/server";
import { logger } from "./logger";

/**
 * Базовый класс для кастомных ошибок
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Ошибка валидации (400)
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

/**
 * Ошибка авторизации (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = "Требуется авторизация") {
    super(message, 401, "UNAUTHORIZED");
  }
}

/**
 * Ошибка доступа (403)
 */
export class ForbiddenError extends AppError {
  constructor(message: string = "Доступ запрещен") {
    super(message, 403, "FORBIDDEN");
  }
}

/**
 * Ресурс не найден (404)
 */
export class NotFoundError extends AppError {
  constructor(resource: string = "Ресурс") {
    super(`${resource} не найден`, 404, "NOT_FOUND");
  }
}

/**
 * Конфликт (409)
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 409, "CONFLICT", details);
  }
}

/**
 * Ошибка лимита (429)
 */
export class RateLimitError extends AppError {
  constructor(message: string = "Превышен лимит запросов") {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
  }
}

/**
 * Ошибка подписки/лимита тарифа (402)
 */
export class SubscriptionError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 402, "SUBSCRIPTION_LIMIT", details);
  }
}

/**
 * Ошибка сервера (500)
 */
export class InternalServerError extends AppError {
  constructor(message: string = "Внутренняя ошибка сервера", details?: Record<string, any>) {
    super(message, 500, "INTERNAL_SERVER_ERROR", details);
  }
}

/**
 * Обработать ошибку и вернуть NextResponse
 */
export function handleError(error: unknown, context?: {
  userId?: number;
  companyId?: number;
  requestId?: string;
  path?: string;
  method?: string;
}): NextResponse {
  // Если это наша кастомная ошибка
  if (error instanceof AppError) {
    logger.error(
      error.message,
      error,
      {
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
      },
      context
    );

    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(error.details && { details: error.details }),
        ...(process.env.NODE_ENV === "development" && {
          stack: error.stack,
        }),
        ...(context?.requestId && { requestId: context.requestId }),
      },
      { status: error.statusCode }
    );
  }

  // Если это Prisma ошибка
  if (error && typeof error === "object" && "code" in error) {
    const prismaError = error as { code: string; message: string; meta?: any };

    switch (prismaError.code) {
      case "P2002":
        // Unique constraint violation
        return handleError(
          new ConflictError("Запись с такими данными уже существует", {
            field: prismaError.meta?.target,
          }),
          context
        );

      case "P2025":
        // Record not found
        return handleError(new NotFoundError("Запись"), context);

      case "P2003":
        // Foreign key constraint violation
        return handleError(
          new ValidationError("Связанная запись не найдена", {
            field: prismaError.meta?.field_name,
          }),
          context
        );

      default:
        logger.error(
          `Prisma error: ${prismaError.code}`,
          error,
          { prismaCode: prismaError.code },
          context
        );
        return handleError(
          new InternalServerError("Ошибка базы данных", {
            code: prismaError.code,
          }),
          context
        );
    }
  }

  // Если это обычная ошибка
  if (error instanceof Error) {
    logger.error(
      error.message,
      error,
      { errorName: error.name },
      context
    );

    // В production не показываем детали ошибки
    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Внутренняя ошибка сервера";

    return NextResponse.json(
      {
        error: message,
        code: "INTERNAL_SERVER_ERROR",
        ...(process.env.NODE_ENV === "development" && {
          stack: error.stack,
          name: error.name,
        }),
        ...(context?.requestId && { requestId: context.requestId }),
      },
      { status: 500 }
    );
  }

  // Неизвестная ошибка
  logger.error(
    "Unknown error",
    new Error(String(error)),
    { errorType: typeof error },
    context
  );

  return NextResponse.json(
    {
      error: "Внутренняя ошибка сервера",
      code: "UNKNOWN_ERROR",
      ...(context?.requestId && { requestId: context.requestId }),
    },
    { status: 500 }
  );
}

/**
 * Обертка для async функций с автоматической обработкой ошибок
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: {
    userId?: number;
    companyId?: number;
    requestId?: string;
    path?: string;
    method?: string;
  }
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw handleError(error, context);
    }
  }) as T;
}

/**
 * Создать успешный ответ
 */
export function createSuccessResponse<T>(
  data: T,
  statusCode: number = 200,
  headers?: Record<string, string>
): NextResponse<T> {
  const response = NextResponse.json(data, { status: statusCode });
  
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }
  
  return response;
}

/**
 * Создать ответ с ошибкой
 */
export function createErrorResponse(
  error: unknown,
  context?: {
    userId?: number;
    companyId?: number;
    requestId?: string;
    path?: string;
    method?: string;
  }
): NextResponse {
  return handleError(error, context);
}

