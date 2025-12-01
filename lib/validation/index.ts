/**
 * Утилиты для валидации данных с помощью Zod
 */

import { z } from 'zod'
import { NextResponse } from 'next/server'

// Экспортируем все схемы
export * from './schemas'

/**
 * Валидировать данные по схеме Zod
 * @param schema - Zod схема
 * @param data - Данные для валидации
 * @returns Результат валидации или ошибка
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: true
  data: T
} | {
  success: false
  error: string
  errors: z.ZodError
} {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  // Форматируем ошибки для пользователя
  const errorMessages = result.error.issues.map(err => {
    const path = err.path.join('.')
    return path ? `${path}: ${err.message}` : err.message
  })
  
  return {
    success: false,
    error: errorMessages.join(', '),
    errors: result.error,
  }
}

/**
 * Middleware для валидации запроса
 * Возвращает NextResponse с ошибкой, если валидация не прошла
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T | NextResponse {
  const validation = validateData(schema, data)
  
  if (!validation.success) {
    return NextResponse.json(
      {
        error: 'Validation Error',
        message: validation.error,
        details: process.env.NODE_ENV === 'development' 
          ? validation.errors.issues 
          : undefined,
      },
      { status: 400 }
    )
  }
  
  return validation.data
}

/**
 * Валидировать query параметры
 */
export function validateQuery<T>(
  schema: z.ZodSchema<T>,
  searchParams: URLSearchParams
): T | NextResponse {
  const params: Record<string, string | string[]> = {}
  
  for (const [key, value] of searchParams.entries()) {
    if (params[key]) {
      // Если уже есть значение, делаем массив
      const existing = params[key]
      params[key] = Array.isArray(existing) 
        ? [...existing, value]
        : [existing as string, value]
    } else {
      params[key] = value
    }
  }
  
  return validateRequest(schema, params)
}

