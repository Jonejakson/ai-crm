import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { checkRateLimit, rateLimitConfigs } from "@/lib/rate-limit"

export async function middleware(request: NextRequest) {
  // Разрешаем доступ к публичным маршрутам
  const publicPaths = [
    '/login',
    '/forgot-password',
    '/reset-password',
    '/api/auth',
    '/api/webforms/public',
    '/api/health',
    '/manifest',
    '/api/company/by-inn/public',
    '/privacy',
    '/terms',
    '/api/admin/reset-password-emergency',
    // Webhooks должны быть публичными (без сессии), иначе внешние системы получат 401
    '/api/webhooks/incoming',
    '/api/billing/webhook',
    '/api/messaging/telegram-bot/webhook',
    '/api/messaging/whatsapp/webhook',
    '/api/advertising/yandex-direct/webhook',
  ]
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path))
  
  // Rate limiting для разных типов endpoints
  const pathname = request.nextUrl.pathname
  const isApiPath = pathname.startsWith('/api/')
  
  // Важно: rate limit применяем ТОЛЬКО к API endpoints.
  // Иначе страницы (/deals и т.п.) могут отдавать 429 JSON вместо HTML при активной работе.
  let rateLimitResult = { success: true, limit: 0, remaining: 0, reset: 0 }
  if (isApiPath) {
    const skipRateLimit =
      pathname.startsWith('/api/ops') ||
      pathname.startsWith('/api/owner') ||
      pathname.startsWith('/api/support')

    // Готовим стабильный ключ для rate limit (одинаковый для всех запросов этого request)
    // Важно: checkRateLimit типизирован как Request, поэтому cookie берем из внешнего NextRequest.
    const allCookies = request.cookies.getAll()
    const sessionTokenCookie = allCookies.find((cookie) =>
      cookie.name === 'authjs.session-token' ||
      cookie.name === '__Secure-authjs.session-token' ||
      cookie.name === 'next-auth.session-token' ||
      cookie.name === '__Secure-next-auth.session-token' ||
      cookie.name.includes('session-token')
    )
    const sessionToken = sessionTokenCookie?.value
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipFromHeader = forwardedFor ? forwardedFor.split(',')[0]?.trim() : undefined
    const ip =
      ipFromHeader ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('true-client-ip') ||
      'unknown'
    const isAuthenticatedRequest = Boolean(sessionToken)
    const rateLimitKey = sessionToken ? `user:${sessionToken}` : `anon:${ip}`

    // Определяем тип endpoint и применяем соответствующий rate limit
    // По умолчанию:
    // - для авторизованных даем больше лимит (UI может делать параллельные запросы)
    // - для анонимных оставляем общий лимит
    let rateLimitConfig = isAuthenticatedRequest ? rateLimitConfigs.authenticated : rateLimitConfigs.api
    
    if (pathname.startsWith('/api/webforms/public')) {
      // Публичные веб-формы - строгий лимит
      rateLimitConfig = rateLimitConfigs.public
    } else if (
      pathname.startsWith('/api/admin') ||
      pathname.startsWith('/api/billing') ||
      pathname.startsWith('/api/deals') ||
      pathname.startsWith('/api/pipelines') ||
      pathname.startsWith('/api/deal-sources') ||
      pathname.startsWith('/api/contacts') ||
      pathname.startsWith('/api/tasks')
    ) {
      // Админские и тяжёлые endpoints (company, billing, deals, users)
      rateLimitConfig = rateLimitConfigs.admin
    } else if (pathname.startsWith('/api/ops') || pathname.startsWith('/api/owner')) {
      // Внутренние эндпоинты владельца/операций
      rateLimitConfig = rateLimitConfigs.admin
    } else if (pathname.startsWith('/api/webhooks') || pathname.includes('/webhook')) {
      // Webhook endpoints - средний лимит
      rateLimitConfig = rateLimitConfigs.webhook
    } else if (pathname.startsWith('/api/notifications') || pathname.startsWith('/api/profile')) {
      // Уведомления и профиль опрашиваются часто
      rateLimitConfig = rateLimitConfigs.admin
    }

    if (!skipRateLimit) {
      // Проверяем rate limit
      rateLimitResult = await checkRateLimit(request, {
        ...rateLimitConfig,
        keyGenerator: () => rateLimitKey,
      })
    }
    
    // Если превышен лимит, возвращаем ошибку
    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
      // Логируем причину 429, чтобы найти источник спама запросов
      // (не выводим session token целиком)
      console.warn(
        '[rate-limit]',
        JSON.stringify({
          path: pathname,
          keyType: isAuthenticatedRequest ? 'user' : 'anon',
          ip,
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          retryAfter,
          userAgent: (request.headers.get('user-agent') || '').slice(0, 120),
        })
      )
      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message: 'Превышен лимит запросов. Попробуйте позже.',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(rateLimitResult.limit),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.reset),
            'Retry-After': String(retryAfter),
            // Debug headers (safe, no secrets)
            'X-RateLimit-Path': pathname,
            'X-RateLimit-KeyType': isAuthenticatedRequest ? 'user' : 'anon',
          },
        }
      )
    }
  }
  
  // Создаем response с заголовками rate limit
  const response = isPublicPath
    ? NextResponse.next()
    : (() => {
        // Проверяем наличие сессионной cookie (NextAuth v5 использует разные имена в зависимости от окружения)
        // Проверяем все возможные варианты имен cookie
        const allCookies = request.cookies.getAll()
        const sessionToken = allCookies.find(
          (cookie) =>
            cookie.name === 'authjs.session-token' ||
            cookie.name === '__Secure-authjs.session-token' ||
            cookie.name === 'next-auth.session-token' ||
            cookie.name === '__Secure-next-auth.session-token' ||
            cookie.name.includes('session-token')
        )

        // Если нет сессионной cookie:
        // - для API возвращаем 401 JSON (не редиректим на HTML /login, иначе это ломает fetch + может попасть в SW cache)
        // - для страниц редиректим на /login
        if (!sessionToken) {
          if (isApiPath) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
          }
          const loginUrl = new URL('/login', request.url)
          // Сохраняем URL, на который пользователь пытался зайти, чтобы вернуться после входа
          if (request.nextUrl.pathname !== '/') {
            loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname)
          }
          return NextResponse.redirect(loginUrl)
        }

        return NextResponse.next()
      })()
  
  // Добавляем заголовки rate limit
  if (isApiPath) {
    response.headers.set('X-RateLimit-Limit', String(rateLimitResult.limit))
    response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining))
    response.headers.set('X-RateLimit-Reset', String(rateLimitResult.reset))
  }
  
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
     * - api/webforms/public (публичные веб-формы)
     * - api/company/by-inn/public (публичный поиск компании по ИНН)
     * - login (страница входа)
     * - _next/static (статические файлы)
     * - _next/image (оптимизация изображений)
     * - favicon.ico
     */
    "/((?!api/auth|api/webforms/public|api/company/by-inn/public|api/admin/reset-password-emergency|login|forgot-password|reset-password|manifest|privacy|terms|_next/static|_next/image|favicon.ico).*)",
  ],
}
