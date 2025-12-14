import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

// В production НЕ загружаем dotenv - используем переменные из Docker/системы
// Загружаем переменные окружения только в development
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config()
  } catch (e) {
    // Игнорируем ошибки загрузки dotenv
  }
}

// Функция для получения Prisma Client (ленивая загрузка)
let prismaInstance: any = null

async function getPrisma() {
  if (!prismaInstance) {
    // Импортируем Prisma только когда он действительно нужен (не в Edge Runtime)
    const prismaModule = await import("./init-prisma")
    prismaInstance = prismaModule.default
  }
  return prismaInstance
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // Для работы в development и production
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.error('❌ Авторизация: отсутствует email или password')
          return null
        }

        try {
          console.log('🔐 Попытка авторизации для:', credentials.email)
          
          // Получаем Prisma только когда нужно (не в Edge Runtime)
          const prisma = await getPrisma()
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email
            },
            include: {
              company: true
            }
          })

          if (!user) {
            console.error('❌ Пользователь не найден:', credentials.email)
            return null
          }

          console.log('✅ Пользователь найден:', user.email, 'Роль:', user.role)

          const isPasswordValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          )

          if (!isPasswordValid) {
            console.error('❌ Неверный пароль для:', credentials.email)
            return null
          }

          console.log('✅ Авторизация успешна для:', credentials.email)
          return {
            id: user.id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
            companyId: user.companyId.toString(),
          }
        } catch (error: any) {
          console.error('❌ Ошибка авторизации:', error.message)
          console.error('Stack:', error.stack)
          return null
        }
      }
    })
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.companyId = (user as any).companyId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.companyId = token.companyId as string
      }
      return session
    },
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
})
