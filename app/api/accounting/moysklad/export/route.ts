import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/get-session"
import { decrypt } from "@/lib/encryption"

function normalizeMoyskladSecret(input: string): string {
  let s = (input || '').trim()
  if (!s) return s
  s = s.replace(/^(Bearer|Token)\s+/i, '').trim()
  if (s.startsWith('{') && s.endsWith('}')) {
    try {
      const obj: any = JSON.parse(s)
      const candidate =
        obj?.token ??
        obj?.access_token ??
        obj?.accessToken ??
        obj?.apiKey ??
        obj?.apikey ??
        obj?.api_key ??
        obj?.password
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
    } catch {
      // ignore
    }
  }
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }
  return s
}

function extractIdFromHref(href?: string): string | null {
  if (!href) return null
  const parts = href.split('/').filter(Boolean)
  const last = parts[parts.length - 1]
  return last || null
}

function employeeMeta(baseUrl: string, employeeId: string) {
  return {
    meta: {
      href: `${baseUrl}/entity/employee/${employeeId}`,
      type: 'employee',
      mediaType: 'application/json',
    },
  }
}

// Выгрузить контакт в МойСклад
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { contactId, dealId, mode } = body

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

    if (!integration || !integration.apiSecret || !integration.apiToken) {
      return NextResponse.json({ error: "МойСклад интеграция не настроена" }, { status: 404 })
    }

    const apiSecret = normalizeMoyskladSecret(await decrypt(integration.apiSecret))
    const apiToken = integration.apiToken // Не шифруется, это публичный email
    const authString = Buffer.from(`${apiToken}:${apiSecret}`).toString('base64')
    const baseUrl = 'https://api.moysklad.ru/api/remap/1.2'

    const settings: any = integration.settings || {}
    const userIdToEmployeeId: Record<string, string> = settings.userIdToEmployeeId || {}
    const employeeId = userIdToEmployeeId[String(user.id)] || null

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
    let counterpartyId = (contact as any).externalId || null

    if (!counterpartyId) {
      // Создаем нового контрагента
      const counterpartyData: any = {
        name: contact.name,
        email: contact.email || undefined,
        phone: contact.phone || undefined,
        legalTitle: contact.company || undefined,
        inn: contact.inn || undefined,
      }
      if (employeeId) {
        counterpartyData.owner = employeeMeta(baseUrl, employeeId)
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

      // Сохраняем externalId в контакт (если поля существуют в базе)
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "Contact" SET "externalId" = $1, "syncedAt" = $2 WHERE id = $3`,
          counterpartyId,
          new Date(),
          contact.id
        )
      } catch (e) {
        // Если поля не существуют, просто логируем
        console.warn('Could not update externalId/syncedAt - fields may not exist in database')
      }
    }

    // Если есть сделка — создаем или обновляем заказ в МойСклад
    let orderId = (deal as any)?.externalId || null
    if (deal) {
      // Режим принудительного обновления
      const forceUpdate = mode === 'sync'
      if (!orderId || forceUpdate) {
        // если надо обновить — пытаемся найти существующий заказ
        let existingOrder: any = null
        if (orderId) {
          const orderResp = await fetch(`${baseUrl}/entity/customerorder/${orderId}`, {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/json',
            },
          })
          if (orderResp.ok) {
            existingOrder = await orderResp.json()
          }
        }

        const orderData: any = {
          name: deal.title,
          description: `Сделка из CRM: ${deal.title}`,
          sum: deal.amount * 100, // МойСклад использует копейки
          agent: {
            meta: {
              href: `${baseUrl}/entity/counterparty/${counterpartyId}`,
              metadataHref: `${baseUrl}/entity/counterparty/metadata`,
              type: 'counterparty',
              mediaType: 'application/json',
            },
          },
        }
        if (employeeId) {
          orderData.owner = employeeMeta(baseUrl, employeeId)
        }

        // Если есть существующий заказ и режим sync — обновляем
        const orderUrl = existingOrder
          ? `${baseUrl}/entity/customerorder/${existingOrder.id}`
          : `${baseUrl}/entity/customerorder`

        const orderMethod = existingOrder ? 'PUT' : 'POST'

        const orderResponse = await fetch(orderUrl, {
          method: orderMethod,
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderData),
        })

        if (orderResponse.ok) {
          const order = await orderResponse.json()
          orderId = order.id

          // Сохраняем externalId и обновляем сумму сделки из заказа (на случай отличий)
          try {
            await prisma.$executeRawUnsafe(
              `UPDATE "Deal" SET "externalId" = $1, "syncedAt" = $2, amount = $3 WHERE id = $4`,
              orderId,
              new Date(),
              typeof order.sum === 'number' ? Math.round(order.sum / 100) : deal.amount,
              deal.id
            )
          } catch (e) {
            // Если поля не существуют, обновляем только amount
            await prisma.deal.update({
              where: { id: deal.id },
              data: {
                amount: typeof order.sum === 'number' ? Math.round(order.sum / 100) : deal.amount,
              },
            })
          }
        } else {
          const errorData = await orderResponse.json().catch(() => ({}))
          console.error('[moysklad][export][order]', errorData)
          // Не прерываем процесс, если заказ не создался/обновился
        }
      }

      // Если mode=sync — подтягиваем позиции заказа и сохраняем в CRM (чтобы видеть товары в сделке)
      if (mode === 'sync' && orderId) {
        try {
          const positionsResp = await fetch(
            `${baseUrl}/entity/customerorder/${orderId}/positions?limit=1000`,
            {
              headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json',
              },
              cache: 'no-store',
            }
          )

          if (positionsResp.ok) {
            const positions = await positionsResp.json()
            const rows: any[] = Array.isArray(positions?.rows) ? positions.rows : []
            const positionIds: string[] = []

            for (const row of rows) {
              const positionId = String(row.id)
              positionIds.push(positionId)

              const assortmentHref: string | undefined = row.assortment?.meta?.href
              const assortmentId =
                row.assortment?.id ? String(row.assortment.id) : extractIdFromHref(assortmentHref)

              const name =
                row.assortment?.name ||
                row.name ||
                (assortmentId ? `Номенклатура ${assortmentId}` : 'Позиция')

              const quantity = typeof row.quantity === 'number' ? row.quantity : Number(row.quantity || 0)
              const priceKopecks = typeof row.price === 'number' ? row.price : Number(row.price || 0)
              const sumKopecks = typeof row.sum === 'number' ? row.sum : Number(row.sum || 0)

              await prisma.dealMoyskladItem.upsert({
                where: {
                  dealId_positionId: {
                    dealId: deal.id,
                    positionId,
                  },
                },
                update: {
                  moyskladOrderId: String(orderId),
                  assortmentId,
                  name,
                  quantity,
                  priceKopecks,
                  sumKopecks,
                },
                create: {
                  dealId: deal.id,
                  moyskladOrderId: String(orderId),
                  positionId,
                  assortmentId,
                  name,
                  quantity,
                  priceKopecks,
                  sumKopecks,
                },
              })
            }

            // Удаляем позиции, которых больше нет в заказе
            await prisma.dealMoyskladItem.deleteMany({
              where: {
                dealId: deal.id,
                moyskladOrderId: String(orderId),
                ...(positionIds.length ? { positionId: { notIn: positionIds } } : {}),
              },
            })
          } else {
            const errorData = await positionsResp.json().catch(() => ({}))
            console.error('[moysklad][export][positions]', errorData)
          }
        } catch (e) {
          console.error('[moysklad][export][positions]', e)
        }
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
      message:
        mode === 'sync'
          ? deal
            ? 'Заказ синхронизирован с МойСклад'
            : 'Контрагент синхронизирован с МойСклад'
          : deal
          ? 'Контакт и заказ выгружены в МойСклад'
          : 'Контакт выгружен в МойСклад',
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

