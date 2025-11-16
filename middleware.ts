import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Импортируем auth напрямую, но не используем Prisma в Edge Runtime
// NextAuth v5 auth() работает в Edge Runtime без Prisma
let auth: any

// Динамический импорт auth только когда нужно (не в Edge Runtime при инициализации модуля)
async function getAuth() {
  if (!auth) {
    // Импортируем auth только когда он действительно нужен
    const authModule = await import("@/lib/auth")
    auth = authModule.auth
  }
  return auth
}

export async function middleware(request: NextRequest) {
  // Разрешаем доступ к публичным маршрутам
  const publicPaths = ['/login', '/api/auth']
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path))
  
  if (isPublicPath) {
    return NextResponse.next()
  }
  
  try {
    const authFn = await getAuth()
    const session = await authFn()
    
    // Если нет сессии, перенаправляем на страницу входа
    if (!session) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }
  } catch (error) {
    // Если ошибка аутентификации, разрешаем доступ (чтобы не блокировать приложение)
    console.error('Auth error in middleware:', error)
  }
  
  return NextResponse.next()
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
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)",
  ],
}
