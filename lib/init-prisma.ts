/**
 * Инициализация Prisma Client с гарантированной загрузкой переменных окружения
 */

import { PrismaClient } from '@prisma/client'

// Загружаем dotenv ПЕРЕД созданием Prisma Client
// Не используем path и process.cwd() для совместимости с Edge Runtime
if (typeof window === 'undefined') {
  try {
    const dotenv = require('dotenv')
    // dotenv.config() автоматически ищет .env в корне проекта
    const result = dotenv.config({ override: true })
    if (result.error) {
      console.warn('⚠️ Ошибка загрузки .env:', result.error)
    } else {
      console.log('✅ .env файл загружен')
    }
  } catch (e) {
    console.warn('⚠️ Ошибка при загрузке dotenv:', e)
  }
}

// Глобальный экземпляр для предотвращения множественных подключений
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Функция для получения DATABASE_URL
function getDatabaseUrl(): string {
  // Пробуем загрузить dotenv еще раз
  if (typeof window === 'undefined') {
    try {
      const dotenv = require('dotenv')
      dotenv.config({ override: true })
    } catch (e) {
      // Игнорируем
    }
  }

  const url = process.env.DATABASE_URL

  // Отладочная информация (только в development)
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Проверка DATABASE_URL:')
    console.log('  Значение из process.env.DATABASE_URL:', url ? url.substring(0, 50) + '...' : 'НЕ НАЙДЕН')
  }

  if (!url) {
    console.error('❌ DATABASE_URL не найден в переменных окружения!')
    console.error('Проверьте файл .env в корне проекта')
    throw new Error(
      'DATABASE_URL не найден в переменных окружения!\n' +
      'Проверьте файл .env в корне проекта.\n' +
      'Должен быть: DATABASE_URL="postgresql://user:password@host:port/database?schema=public"'
    )
  }

  // Проверяем, что это не SQLite URL
  if (url.startsWith('file:')) {
    console.error('❌ Обнаружен SQLite URL в DATABASE_URL!')
    console.error('Текущее значение:', url)
    console.error('')
    console.error('⚠️ ВАЖНО: Вы мигрировали на PostgreSQL, но в .env файле все еще указан SQLite URL!')
    console.error('')
    console.error('Исправьте файл .env:')
    console.error('DATABASE_URL="postgresql://postgres:ВАШ_ПАРОЛЬ@localhost:5432/crm_db?schema=public"')
    console.error('')
    throw new Error(
      'В .env файле указан SQLite URL (file:./prisma/dev.db), но схема настроена на PostgreSQL!\n' +
      'Исправьте DATABASE_URL в файле .env на:\n' +
      'DATABASE_URL="postgresql://postgres:ВАШ_ПАРОЛЬ@localhost:5432/crm_db?schema=public"'
    )
  }

  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    console.error('❌ Неверный формат DATABASE_URL:', url.substring(0, 50))
    throw new Error(
      `Неверный формат DATABASE_URL: должен начинаться с postgresql:// или postgres://\n` +
      `Текущее значение: ${url.substring(0, 50)}...`
    )
  }

  return url
}

// Создаем Prisma Client лениво
function createPrismaClient(): PrismaClient {
  const databaseUrl = getDatabaseUrl()
  
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ Создание Prisma Client с DATABASE_URL:', databaseUrl.substring(0, 30) + '...')
  }
  
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })
}

// Используем глобальный экземпляр для предотвращения множественных подключений
export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
