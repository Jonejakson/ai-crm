import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/get-session"

// Получить 1С интеграцию компании
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const companyId = parseInt(user.companyId)
    const integration = await prisma.accountingIntegration.findFirst({
      where: { 
        companyId,
        platform: 'ONE_C'
      },
    })

    return NextResponse.json(integration || null)
  } catch (error) {
    console.error("[one-c][GET]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// Создать или обновить 1С интеграцию
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const companyId = parseInt(user.companyId)

    // Для 1С нужны:
    // - baseUrl (URL базы 1С, например: http://server:port/base)
    // - apiToken или login/password
    // - accountId (опционально, ID организации в 1С)
    
    if (!body.baseUrl || !body.baseUrl.trim()) {
      return NextResponse.json({ error: "URL базы 1С обязателен" }, { status: 400 })
    }

    // Проверяем формат URL
    try {
      new URL(body.baseUrl.trim())
    } catch {
      return NextResponse.json({ error: "Неверный формат URL" }, { status: 400 })
    }

    // Проверяем, существует ли уже интеграция
    const existing = await prisma.accountingIntegration.findFirst({
      where: {
        companyId,
        platform: 'ONE_C'
      },
    })

    // Если обновляем и пароль/токен не указан, используем старый
    let apiTokenToUse = body.apiToken?.trim()
    let apiSecretToUse = body.apiSecret?.trim() || body.password?.trim()
    
    if (existing) {
      if (!apiTokenToUse || apiTokenToUse === '') {
        apiTokenToUse = existing.apiToken || ''
      }
      if (!apiSecretToUse || apiSecretToUse === '') {
        apiSecretToUse = existing.apiSecret || ''
      }
    }

    // Для 1С может быть либо токен, либо логин/пароль
    if (!apiTokenToUse && !apiSecretToUse) {
      return NextResponse.json({ error: "Укажите API токен или логин/пароль" }, { status: 400 })
    }

    // Проверяем подключение к 1С API (если указан токен или логин/пароль)
    if (apiTokenToUse || apiSecretToUse) {
      try {
        const baseUrl = body.baseUrl.trim().replace(/\/$/, '') // Убираем слэш в конце
        const testUrl = `${baseUrl}/hs/crm/api/v1/test` // Стандартный endpoint для проверки
        
        // Пробуем подключиться (может быть разная авторизация)
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        }

        // Если есть токен, используем Bearer авторизацию
        if (apiTokenToUse) {
          headers['Authorization'] = `Bearer ${apiTokenToUse}`
        } else if (apiSecretToUse) {
          // Если есть логин и пароль, используем Basic авторизацию
          const login = body.login?.trim() || ''
          if (login) {
            const authString = Buffer.from(`${login}:${apiSecretToUse}`).toString('base64')
            headers['Authorization'] = `Basic ${authString}`
          }
        }

        const testResponse = await fetch(testUrl, {
          method: 'GET',
          headers,
          // Увеличиваем таймаут для 1С
          signal: AbortSignal.timeout(10000), // 10 секунд
        })

        // Если endpoint не существует, это нормально (не все 1С имеют /test endpoint)
        // Проверяем только, что сервер отвечает
        if (testResponse.status === 404) {
          // 404 - нормально, endpoint может не существовать
        } else if (!testResponse.ok && testResponse.status !== 401) {
          // 401 - тоже может быть нормально, если нужна другая авторизация
          console.warn('[one-c][test]', `Сервер ответил со статусом ${testResponse.status}`)
        }
      } catch (testError: any) {
        // Не блокируем сохранение, если не удалось подключиться
        // Пользователь может настроить подключение позже
        console.warn('[one-c][test]', 'Не удалось проверить подключение:', testError.message)
      }
    }

    // Upsert интеграцию
    const integration = await prisma.accountingIntegration.upsert({
      where: {
        companyId_platform: {
          companyId,
          platform: 'ONE_C'
        }
      },
      update: {
        name: body.name?.trim() || null,
        baseUrl: body.baseUrl.trim(),
        apiToken: apiTokenToUse || null,
        apiSecret: apiSecretToUse || null,
        accountId: body.accountId?.trim() || null,
        isActive: body.isActive !== false,
        syncContacts: body.syncContacts !== false,
        syncDeals: body.syncDeals !== false,
        syncProducts: body.syncProducts === true,
        autoSync: body.autoSync === true,
        syncInterval: body.syncInterval || 60,
        contactMapping: body.contactMapping || null,
        dealMapping: body.dealMapping || null,
        settings: body.settings || null,
      },
      create: {
        platform: 'ONE_C',
        name: body.name?.trim() || null,
        baseUrl: body.baseUrl.trim(),
        apiToken: apiTokenToUse || null,
        apiSecret: apiSecretToUse || null,
        accountId: body.accountId?.trim() || null,
        isActive: body.isActive !== false,
        syncContacts: body.syncContacts !== false,
        syncDeals: body.syncDeals !== false,
        syncProducts: body.syncProducts === true,
        autoSync: body.autoSync === true,
        syncInterval: body.syncInterval || 60,
        contactMapping: body.contactMapping || null,
        dealMapping: body.dealMapping || null,
        settings: body.settings || null,
        companyId,
      },
    })

    return NextResponse.json(integration)
  } catch (error) {
    console.error("[one-c][POST]", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

