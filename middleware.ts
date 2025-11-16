import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  // Разрешаем доступ к публичным маршрутам
  const publicPaths = ['/login', '/api/auth']
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path))
  
  if (isPublicPath) {
    return NextResponse.next()
  }
  
  // Проверяем наличие сессионной cookie (NextAuth создает authjs.session-token)
  // Это легковесная проверка без импорта тяжелых зависимостей
  const sessionToken = request.cookies.get('authjs.session-token') || 
                       request.cookies.get('__Secure-authjs.session-token')
  
  // Если нет сессионной cookie, перенаправляем на страницу входа
  if (!sessionToken) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
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
