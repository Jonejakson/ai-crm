/**
 * Rate Limiting для защиты от DDoS и злоупотреблений
 * Использует простую реализацию на основе памяти (для Vercel Edge)
 * Для production рекомендуется использовать Redis (Upstash)
 */

interface RateLimitConfig {
  windowMs: number // Окно времени в миллисекундах
  maxRequests: number // Максимальное количество запросов
  keyGenerator?: (request: Request) => string // Функция для генерации ключа
}

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number // Timestamp когда лимит сбросится
}

// In-memory хранилище (для Edge Runtime)
// В production лучше использовать Redis
const requestCounts = new Map<string, { count: number; resetAt: number }>()

// Очистка старых записей каждые 5 минут
if (typeof global !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, value] of requestCounts.entries()) {
      if (value.resetAt < now) {
        requestCounts.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

/**
 * Проверить rate limit для запроса
 */
export async function checkRateLimit(
  request: Request,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { windowMs, maxRequests, keyGenerator } = config

  // Генерируем ключ для идентификации клиента
  const key = keyGenerator
    ? keyGenerator(request)
    : getDefaultKey(request)

  const now = Date.now()
  const resetAt = now + windowMs

  // Получаем текущий счетчик
  const current = requestCounts.get(key)

  if (!current || current.resetAt < now) {
    // Создаем новый счетчик
    requestCounts.set(key, { count: 1, resetAt })
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      reset: resetAt,
    }
  }

  // Увеличиваем счетчик
  current.count++

  if (current.count > maxRequests) {
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      reset: current.resetAt,
    }
  }

  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - current.count,
    reset: current.resetAt,
  }
}

/**
 * Генерация ключа по умолчанию
 */
function getDefaultKey(request: Request): string {
  // Используем IP адрес или user-agent
  const ip = getClientIp(request)
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  // Комбинируем IP и User-Agent для более точной идентификации
  return `${ip}:${userAgent.substring(0, 50)}`
}

/**
 * Получить IP адрес клиента
 */
function getClientIp(request: Request): string {
  // Проверяем заголовки прокси
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback
  return 'unknown'
}

/**
 * Предустановленные конфигурации rate limit
 */
export const rateLimitConfigs = {
  // Публичные endpoints (веб-формы, публичные API)
  public: {
    windowMs: 60 * 1000, // 1 минута
    maxRequests: 100,
  },
  
  // Авторизованные пользователи
  authenticated: {
    windowMs: 60 * 1000, // 1 минута
    maxRequests: 1000,
  },
  
  // Админы
  admin: {
    windowMs: 60 * 1000, // 1 минута
    maxRequests: 5000,
  },
  
  // Webhook endpoints (более строгий лимит)
  webhook: {
    windowMs: 60 * 1000, // 1 минута
    maxRequests: 200,
  },
  
  // API endpoints (общий лимит)
  api: {
    windowMs: 60 * 1000, // 1 минута
    maxRequests: 500,
  },
}

/**
 * Создать middleware для rate limiting
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async (request: Request): Promise<Response | null> => {
    const result = await checkRateLimit(request, config)

    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: 'Too Many Requests',
          message: 'Превышен лимит запросов. Попробуйте позже.',
          retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(result.limit),
            'X-RateLimit-Remaining': String(result.remaining),
            'X-RateLimit-Reset': String(result.reset),
            'Retry-After': String(Math.ceil((result.reset - Date.now()) / 1000)),
          },
        }
      )
    }

    // Добавляем заголовки с информацией о лимите
    // (это будет сделано в middleware или в каждом endpoint)
    return null
  }
}

