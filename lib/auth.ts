import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

// Загружаем переменные окружения ПЕРЕД импортом Prisma
// Но НЕ импортируем Prisma здесь, чтобы избежать проблем с Edge Runtime
if (typeof window === 'undefined') {
  try {
    require('dotenv').config({ override: true })
  } catch (e) {
    // dotenv уже загружен
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
          return null
        }

        try {
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
            return null
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          )

          if (!isPasswordValid) {
            return null
          }

          return {
            id: user.id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
            companyId: user.companyId.toString(),
          }
        } catch (error: any) {
          console.error('Ошибка авторизации:', error)
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
