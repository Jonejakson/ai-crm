import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/get-session"
import { decrypt } from "@/lib/encryption"

// Выгрузить контакт/сделку в 1С
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { contactId, dealId } = body

    if (!contactId && !dealId) {
      return NextResponse.json({ error: "contactId или dealId обязателен" }, { status: 400 })
    }

    const companyId = parseInt(user.companyId)
    
    // Находим активную 1С интеграцию
    const integration = await prisma.accountingIntegration.findFirst({
      where: {
        companyId,
        platform: 'ONE_C',
        isActive: true,
        baseUrl: { not: null },
      },
    })

    if (!integration) {
      return NextResponse.json({ error: "1С интеграция не настроена" }, { status: 404 })
    }

    if (!integration.baseUrl) {
      return NextResponse.json({ error: "URL базы 1С не указан" }, { status: 400 })
    }

    let contact = null
    let deal = null

    // Получаем контакт
    if (contactId) {
      contact = await prisma.contact.findFirst({
        where: {
          id: Number(contactId),
          user: { companyId },
        },
      })
    }

    // Получаем сделку и связанный контакт
    if (dealId) {
      deal = await prisma.deal.findFirst({
        where: {
          id: Number(dealId),
          user: { companyId },
        },
        include: { contact: true },
      })
      if (deal && deal.contact) {
        contact = deal.contact
      }
    }

    if (!contact) {
      return NextResponse.json({ error: "Контакт не найден" }, { status: 404 })
    }

    const baseUrl = integration.baseUrl.replace(/\/$/, '') // Убираем слэш в конце
    
    // Подготавливаем заголовки для авторизации
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (integration.apiToken) {
      const apiToken = await decrypt(integration.apiToken)
      headers['Authorization'] = `Bearer ${apiToken}`
    } else if (integration.apiSecret) {
      // Если есть логин и пароль, используем Basic авторизацию
      // Логин может быть в settings или в apiToken (если используется как логин)
      const login = (integration.settings as any)?.login || ''
      if (login) {
        const apiSecret = await decrypt(integration.apiSecret)
        const authString = Buffer.from(`${login}:${apiSecret}`).toString('base64')
        headers['Authorization'] = `Basic ${authString}`
      }
    }

    // Создаем или обновляем контрагента в 1С
    let counterpartyId = (contact as any).externalId || null

    if (!counterpartyId) {
      // Создаем нового контрагента
      // Формат данных зависит от API 1С, используем стандартный формат
      const counterpartyData: any = {
        Наименование: contact.name,
        ИНН: contact.inn || undefined,
        Телефон: contact.phone || undefined,
        Email: contact.email || undefined,
        ЮридическоеЛицо: contact.company ? true : false,
      }

      if (contact.company) {
        counterpartyData['НаименованиеПолное'] = contact.company
      }

      // Пробуем разные варианты endpoints для 1С
      const endpoints = [
        '/hs/crm/api/v1/counterparty',
        '/hs/crm/counterparty',
        '/api/counterparty',
      ]

      let created = false
      for (const endpoint of endpoints) {
        try {
          const createResponse = await fetch(`${baseUrl}${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(counterpartyData),
            signal: AbortSignal.timeout(15000), // 15 секунд
          })

          if (createResponse.ok) {
            const counterparty = await createResponse.json()
            counterpartyId = counterparty.id || counterparty.Ид || counterparty.Ref_Key
            created = true
            break
          } else if (createResponse.status === 404) {
            // Endpoint не существует, пробуем следующий
            continue
          } else {
            const errorText = await createResponse.text()
            console.error(`[one-c][export][counterparty] ${endpoint}`, errorText)
          }
        } catch (error) {
          console.error(`[one-c][export][counterparty] ${endpoint}`, error)
          continue
        }
      }

      if (!created) {
        throw new Error('Не удалось создать контрагента в 1С. Проверьте настройки API и URL.')
      }

      // Сохраняем externalId в контакт (если поля существуют в базе)
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "Contact" SET "externalId" = $1, "syncedAt" = $2 WHERE id = $3`,
          counterpartyId,
          new Date(),
          contact.id
        )
      } catch (e) {
        console.warn('Could not update externalId/syncedAt - fields may not exist in database')
      }
    }

    // Если есть сделка, создаем документ продажи в 1С
    let orderId = null
    if (deal && !(deal as any).externalId) {
      const orderData: any = {
        Наименование: deal.title,
        Контрагент: counterpartyId,
        Сумма: deal.amount,
        Валюта: deal.currency || 'RUB',
        Дата: new Date().toISOString().split('T')[0],
      }

      // Пробуем разные варианты endpoints для создания заказа
      const endpoints = [
        '/hs/crm/api/v1/order',
        '/hs/crm/order',
        '/api/order',
        '/hs/crm/api/v1/sale',
        '/hs/crm/sale',
      ]

      let created = false
      for (const endpoint of endpoints) {
        try {
          const orderResponse = await fetch(`${baseUrl}${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(orderData),
            signal: AbortSignal.timeout(15000),
          })

          if (orderResponse.ok) {
            const order = await orderResponse.json()
            orderId = order.id || order.Ид || order.Ref_Key
            created = true
            break
          } else if (orderResponse.status === 404) {
            continue
          } else {
            const errorText = await orderResponse.text()
            console.error(`[one-c][export][order] ${endpoint}`, errorText)
          }
        } catch (error) {
          console.error(`[one-c][export][order] ${endpoint}`, error)
          continue
        }
      }

      if (created && orderId) {
        // Сохраняем externalId в сделку (если поля существуют в базе)
        try {
          await prisma.$executeRawUnsafe(
            `UPDATE "Deal" SET "externalId" = $1, "syncedAt" = $2 WHERE id = $3`,
            orderId,
            new Date(),
            deal.id
          )
        } catch (e) {
          console.warn('Could not update externalId/syncedAt in deal - fields may not exist in database')
        }
      } else {
        console.warn('[one-c][export]', 'Не удалось создать заказ в 1С, но контрагент создан')
      }
    }

    // Сохраняем лог
    await prisma.accountingLog.create({
      data: {
        accountingId: integration.id,
        action: deal ? 'create_order' : 'create_contact',
        entityType: deal ? 'deal' : 'contact',
        entityId: deal ? deal.id : contact.id,
        externalId: deal ? orderId : counterpartyId,
        payload: { contact, deal },
        response: { success: true, counterpartyId, orderId },
        status: 'success',
      },
    })

    return NextResponse.json({
      success: true,
      message: deal ? 'Контакт и заказ выгружены в 1С' : 'Контакт выгружен в 1С',
      counterpartyId,
      orderId,
    })
  } catch (error) {
    console.error("[one-c][export]", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    
    // Сохраняем лог с ошибкой
    try {
      const user = await getCurrentUser()
      if (user) {
        const companyId = parseInt(user.companyId)
        const integration = await prisma.accountingIntegration.findFirst({
          where: { companyId, platform: 'ONE_C' },
        })
        if (integration) {
          await prisma.accountingLog.create({
            data: {
              accountingId: integration.id,
              action: 'export',
              payload: {},
              response: { error: message },
              status: 'error',
              errorMessage: message,
            },
          })
        }
      }
    } catch (logError) {
      console.error("[one-c][export][log]", logError)
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

