import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/get-session"
import { encrypt } from "@/lib/encryption"
import { checkAccountingIntegrationsAccess } from "@/lib/subscription-limits"
import { normalizeMoyskladSecret, makeMoyskladHeaders, type MoyskladAuthMode } from "@/lib/moysklad-auth"

// Получить МойСклад интеграцию компании
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
        platform: 'MOYSKLAD'
      },
    })

    return NextResponse.json(integration || null)
  } catch (error) {
    console.error("[moysklad][GET]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// Создать или обновить МойСклад интеграцию
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const companyId = parseInt(user.companyId)
    
    // Проверка доступа к учетным системам
    const accountingAccess = await checkAccountingIntegrationsAccess(companyId)
    if (!accountingAccess.allowed) {
      return NextResponse.json(
        { error: accountingAccess.message || "Интеграции с учетными системами недоступны для вашего тарифа" },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Для МойСклад нужны:
    // - Login (email)
    // - Password (API ключ)
    // Или можно использовать токен доступа
    
    const login = String(body.login || '').trim()

    // Проверяем, существует ли уже интеграция
    const existing = await prisma.accountingIntegration.findFirst({
      where: {
        companyId,
        platform: 'MOYSKLAD'
      },
    })

    // Если обновляем и пароль не указан, используем старый
    const normalized = normalizeMoyskladSecret(body.password || '')
    let passwordToUse = normalized.secret
    if (existing && (!passwordToUse || passwordToUse === '')) {
      passwordToUse = existing.apiSecret || ''
    }

    if (!passwordToUse) {
      return NextResponse.json({ error: "Password/API ключ обязателен" }, { status: 400 })
    }

    // Проверяем подключение к МойСклад API
    try {
      const testUrl = 'https://api.moysklad.ru/api/remap/1.2/entity/organization'

      // 1) Пробуем Basic, если есть логин
      let mode: MoyskladAuthMode = 'basic'
      let testResponse: Response | null = null
      if (login) {
        testResponse = await fetch(testUrl, {
          headers: makeMoyskladHeaders({ mode, login, secret: passwordToUse }),
          cache: 'no-store',
        })
      }

      // 2) Если Basic не подошел (или логин не задан) — пробуем Bearer (для JSON API токенов тоже встречается)
      if (!testResponse || !testResponse.ok) {
        const bearerResponse = await fetch(testUrl, {
          headers: makeMoyskladHeaders({ mode: 'bearer', secret: passwordToUse }),
          cache: 'no-store',
        })
        if (bearerResponse.ok) {
          mode = 'bearer'
          testResponse = bearerResponse
        }
      }

      if (!testResponse || !testResponse.ok) {
        const errorData = await (testResponse?.json().catch(() => ({})) ?? Promise.resolve({}))
        const msg =
          errorData?.errors?.[0]?.error ||
          `Неверные учетные данные МойСклад (HTTP ${testResponse?.status || 0})`
        return NextResponse.json({ error: msg }, { status: 400 })
      }

      // Запоминаем режим авторизации
      body.settings = {
        ...(body.settings || {}),
        moyskladAuthMode: mode,
      }
    } catch (testError) {
      return NextResponse.json({ error: "Не удалось подключиться к МойСклад API" }, { status: 400 })
    }

    // Upsert интеграцию
    const integration = await prisma.accountingIntegration.upsert({
      where: {
        companyId_platform: {
          companyId,
          platform: 'MOYSKLAD'
        }
      },
      update: {
        name: body.name?.trim() || null,
        apiToken: login || null, // Сохраняем login как apiToken (не шифруем)
        apiSecret: encrypt(passwordToUse), // Шифруем пароль/API ключ (нормализованный)
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
        platform: 'MOYSKLAD',
        name: body.name?.trim() || null,
        apiToken: login || null,
        apiSecret: encrypt(passwordToUse),
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
    console.error("[moysklad][POST]", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

