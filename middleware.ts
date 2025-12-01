import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { checkRateLimit, rateLimitConfigs } from "@/lib/rate-limit"

export async function middleware(request: NextRequest) {
  // Разрешаем доступ к публичным маршрутам
  const publicPaths = ['/login', '/api/auth', '/api/webforms/public', '/api/health']
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path))
  
  // Rate limiting для разных типов endpoints
  const pathname = request.nextUrl.pathname
  
  // Определяем тип endpoint и применяем соответствующий rate limit
  let rateLimitConfig = rateLimitConfigs.api // По умолчанию
  
  if (pathname.startsWith('/api/webforms/public')) {
    // Публичные веб-формы - строгий лимит
    rateLimitConfig = rateLimitConfigs.public
  } else if (pathname.startsWith('/api/webhooks') || pathname.includes('/webhook')) {
    // Webhook endpoints - средний лимит
    rateLimitConfig = rateLimitConfigs.webhook
  } else if (pathname.startsWith('/api/')) {
    // Остальные API endpoints - стандартный лимит
    rateLimitConfig = rateLimitConfigs.api
  }
  
  // Проверяем rate limit
  const rateLimitResult = await checkRateLimit(request, {
    ...rateLimitConfig,
    keyGenerator: (req) => {
      // Для авторизованных пользователей используем их ID
      const sessionToken = req.headers.get('cookie')?.includes('authjs.session-token')
      if (sessionToken) {
        // Пытаемся извлечь user ID из cookie (упрощенная версия)
        // В реальности лучше использовать JWT декодирование
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                  req.headers.get('x-real-ip') || 
                  'unknown'
        return `user:${ip}`
      }
      // Для неавторизованных используем IP
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                req.headers.get('x-real-ip') || 
                'unknown'
      return `anon:${ip}`
    },
  })
  
  // Если превышен лимит, возвращаем ошибку
  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error: 'Too Many Requests',
        message: 'Превышен лимит запросов. Попробуйте позже.',
        retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.reset),
          'Retry-After': String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000)),
        },
      }
    )
  }
  
  // Создаем response с заголовками rate limit
  const response = isPublicPath 
    ? NextResponse.next()
    : (() => {
        // Проверяем наличие сессионной cookie (NextAuth создает authjs.session-token)
        const sessionToken = request.cookies.get('authjs.session-token') || 
                             request.cookies.get('__Secure-authjs.session-token')
        
        // Если нет сессионной cookie, перенаправляем на страницу входа
        if (!sessionToken) {
          const loginUrl = new URL('/login', request.url)
          loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname)
          return NextResponse.redirect(loginUrl)
        }
        
        return NextResponse.next()
      })()
  
  // Добавляем заголовки rate limit
  response.headers.set('X-RateLimit-Limit', String(rateLimitResult.limit))
  response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining))
  response.headers.set('X-RateLimit-Reset', String(rateLimitResult.reset))
  
  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  // Content Security Policy
  // Разрешаем только наш домен и необходимые внешние ресурсы
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-inline и unsafe-eval для Next.js
    "style-src 'self' 'unsafe-inline'", // unsafe-inline для Tailwind CSS
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.openai.com https://*.vercel.app", // OpenAI API и Vercel
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  
  response.headers.set('Content-Security-Policy', csp)
  
  // Strict Transport Security (только для HTTPS)
  if (request.url.startsWith('https://')) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }
  
  return response
}

export const config = {
  matcher: [
    /*
     * Защищаем все маршруты кроме:
     * - api/auth (NextAuth endpoints)
     * - login (страница входа)
     * - _next/static (статические файлы)
     * - _next/image (оптимизация изображений)
     * - favicon.ico
     */
    "/((?!api/auth|api/webforms/public|login|_next/static|_next/image|favicon.ico).*)",
  ],
}
