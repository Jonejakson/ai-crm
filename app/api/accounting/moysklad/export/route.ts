import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/get-session"

// Выгрузить контакт в МойСклад
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
    
    // Находим активную МойСклад интеграцию
    const integration = await prisma.accountingIntegration.findFirst({
      where: {
        companyId,
        platform: 'MOYSKLAD',
        isActive: true,
        apiToken: { not: null },
        apiSecret: { not: null },
      },
    })

    if (!integration) {
      return NextResponse.json({ error: "МойСклад интеграция не настроена" }, { status: 404 })
    }

    const authString = Buffer.from(`${integration.apiToken}:${integration.apiSecret}`).toString('base64')
    const baseUrl = 'https://api.moysklad.ru/api/remap/1.2'

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

    // Создаем или обновляем контрагента в МойСклад
    let counterpartyId = contact.externalId

    if (!counterpartyId) {
      // Создаем нового контрагента
      const counterpartyData: any = {
        name: contact.name,
        email: contact.email || undefined,
        phone: contact.phone || undefined,
        legalTitle: contact.company || undefined,
        inn: contact.inn || undefined,
      }

      const createResponse = await fetch(`${baseUrl}/entity/counterparty`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(counterpartyData),
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}))
        throw new Error(errorData.errors?.[0]?.error || 'Не удалось создать контрагента')
      }

      const counterparty = await createResponse.json()
      counterpartyId = counterparty.id

      // Сохраняем externalId в контакт
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          externalId: counterpartyId,
          syncedAt: new Date(),
        },
      })
    }

    // Если есть сделка, создаем заказ в МойСклад
    let orderId = null
    if (deal && !deal.externalId) {
      const orderData: any = {
        name: deal.title,
        description: `Сделка из CRM: ${deal.title}`,
        sum: deal.amount * 100, // МойСклад использует копейки
        currency: {
          meta: {
            href: `${baseUrl}/entity/currency/${deal.currency === 'RUB' ? 'b72b4c1-6a7c-11e3-9fa0-504800000006' : 'b72b4c1-6a7c-11e3-9fa0-504800000006'}`,
            metadataHref: `${baseUrl}/entity/currency/metadata`,
            type: 'currency',
            mediaType: 'application/json',
          },
        },
        agent: {
          meta: {
            href: `${baseUrl}/entity/counterparty/${counterpartyId}`,
            metadataHref: `${baseUrl}/entity/counterparty/metadata`,
            type: 'counterparty',
            mediaType: 'application/json',
          },
        },
        organization: {
          meta: {
            href: `${baseUrl}/entity/organization`,
            metadataHref: `${baseUrl}/entity/organization/metadata`,
            type: 'organization',
            mediaType: 'application/json',
          },
        },
      }

      const orderResponse = await fetch(`${baseUrl}/entity/customerorder`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      })

      if (orderResponse.ok) {
        const order = await orderResponse.json()
        orderId = order.id

        // Сохраняем externalId в сделку
        await prisma.deal.update({
          where: { id: deal.id },
          data: {
            externalId: orderId,
            syncedAt: new Date(),
          },
        })
      } else {
        const errorData = await orderResponse.json().catch(() => ({}))
        console.error('[moysklad][export][order]', errorData)
        // Не прерываем процесс, если заказ не создался
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
      message: deal ? 'Контакт и заказ выгружены в МойСклад' : 'Контакт выгружен в МойСклад',
      counterpartyId,
      orderId,
    })
  } catch (error) {
    console.error("[moysklad][export]", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    
    // Сохраняем лог с ошибкой
    try {
      const user = await getCurrentUser()
      if (user) {
        const companyId = parseInt(user.companyId)
        const integration = await prisma.accountingIntegration.findFirst({
          where: { companyId, platform: 'MOYSKLAD' },
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
      console.error("[moysklad][export][log]", logError)
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

