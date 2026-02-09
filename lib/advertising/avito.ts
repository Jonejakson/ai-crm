import prisma from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { parsePipelineStages } from '@/lib/pipelines'
import { processAutomations } from '@/lib/automations'

type AvitoTokenResponse = {
  access_token?: string
  accessToken?: string
  token_type?: string
  tokenType?: string
  expires_in?: number
  expiresIn?: number
}

export type AvitoRoutingSettings = {
  mode?: 'default' | 'avito_manager' | 'ad'
  managerToUserId?: Record<string, number>
  adToUserId?: Record<string, number>
}

export type AvitoIntegrationSettings = {
  avito?: {
    lastSyncAt?: string
    cursor?: string
  }
  routing?: AvitoRoutingSettings
}

function getSettings(integration: any): AvitoIntegrationSettings {
  const raw = integration?.settings
  return (raw && typeof raw === 'object') ? (raw as AvitoIntegrationSettings) : {}
}

function withSettings(integration: any, next: AvitoIntegrationSettings) {
  return prisma.advertisingIntegration.update({
    where: { id: integration.id },
    data: { settings: next as any },
  })
}

function pickAssigneeUserId(opts: {
  integration: any
  externalManagerId?: string | null
  externalAdId?: string | null
}): number | null {
  const { integration, externalManagerId, externalAdId } = opts
  const settings = getSettings(integration)
  const routing = settings.routing || {}

  if (routing.mode === 'avito_manager' && externalManagerId) {
    const mapped = routing.managerToUserId?.[String(externalManagerId)]
    if (typeof mapped === 'number') return mapped
  }

  if (routing.mode === 'ad' && externalAdId) {
    const mapped = routing.adToUserId?.[String(externalAdId)]
    if (typeof mapped === 'number') return mapped
  }

  return integration.defaultAssigneeId || null
}

function abortableTimeout(ms: number) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), ms)
  return { controller, done: () => clearTimeout(t) }
}

async function avitoFetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<{ ok: true; data: T } | { ok: false; status: number; text: string }> {
  const { timeoutMs = 15000, ...rest } = init
  const { controller, done } = abortableTimeout(timeoutMs)
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal })
    const text = await res.text()
    if (!res.ok) {
      return { ok: false, status: res.status, text: text.slice(0, 2000) }
    }
    return { ok: true, data: JSON.parse(text) as T }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, status: 0, text: msg }
  } finally {
    done()
  }
}

export async function getAvitoAccessToken(params: {
  clientIdEncrypted: string
  clientSecretEncrypted: string
}): Promise<string> {
  const clientId = decrypt(params.clientIdEncrypted)
  const clientSecret = decrypt(params.clientSecretEncrypted)
  if (!clientId || !clientSecret) {
    throw new Error('Avito credentials are missing (clientId/clientSecret)')
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  }).toString()

  // Avito API: POST с form-urlencoded (OAuth 2.0). GET /token/ возвращает 404 в новых версиях.
  const url = 'https://api.avito.ru/token'
  const resp = await avitoFetchJson<AvitoTokenResponse>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    timeoutMs: 15000,
  })
  if (!resp.ok) {
    throw new Error(`Avito token error: status=${resp.status} body=${resp.text}`)
  }
  const token = resp.data?.access_token ?? resp.data?.accessToken
  if (!token) {
    throw new Error('Avito token error: no access_token in response')
  }
  return token
}

/**
 * ВАЖНО: Avito не всегда предоставляет исходящие webhook'и.
 * Поэтому sync делает polling через API.
 */
/** Диагностика подключения к Avito API — для отладки при 0 обработанных */
export async function debugAvito(params: { companyId: number }) {
  const integration = await prisma.advertisingIntegration.findFirst({
    where: { companyId: params.companyId, platform: 'AVITO' },
  })
  if (!integration || !integration.isActive) {
    return { error: 'Avito integration not found or disabled' }
  }

  const accountId = integration.accountId ? decrypt(integration.accountId)?.trim() : null
  if (!accountId) {
    return { error: 'User ID не указан', hint: 'Укажите «Номер профиля» из портала Авито' }
  }

  let token: string
  try {
    token = await getAvitoAccessToken({
      clientIdEncrypted: integration.apiToken!,
      clientSecretEncrypted: integration.apiSecret!,
    })
  } catch (e) {
    return { error: 'Ошибка токена', details: e instanceof Error ? e.message : String(e) }
  }

  const chatsUrl = `https://api.avito.ru/messenger/v2/accounts/${encodeURIComponent(accountId)}/chats?limit=5`
  const chatsResp = await avitoFetchJson<any>(chatsUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    timeoutMs: 15000,
  })

  if (!chatsResp.ok) {
    return {
      error: 'Ошибка при запросе чатов',
      status: chatsResp.status,
      body: chatsResp.text,
      url: chatsUrl,
      hint: 'Проверьте User ID (номер профиля из портала Авито). Неверный ID даёт 404.',
    }
  }

  const data = chatsResp.data
  const chats = (data.chats ?? data.result?.chats ?? data.result?.items ?? (Array.isArray(data.result) ? data.result : data.items) ?? []) as any[]
  const chatKeys = chats.length > 0 ? Object.keys(chats[0] || {}) : []
  const topLevelKeys = Object.keys(data)

  return {
    ok: true,
    tokenReceived: !!token,
    accountIdPreview: accountId.length > 6 ? `${accountId.slice(0, 3)}...${accountId.slice(-3)}` : '***',
    chatsCount: Array.isArray(chats) ? chats.length : 0,
    topLevelKeys,
    firstChatKeys: chatKeys,
    rawSample: chats[0] ? JSON.stringify(chats[0]).slice(0, 500) : null,
  }
}

export async function syncAvito(params: { companyId: number; limit?: number; debug?: boolean }) {
  const { companyId, limit = 30, debug = false } = params

  const integration = await prisma.advertisingIntegration.findFirst({
    where: {
      companyId,
      platform: 'AVITO',
    },
    include: {
      defaultAssignee: true,
      defaultSource: true,
      defaultPipeline: true,
    },
  })

  if (!integration) {
    throw new Error('Avito integration not found')
  }

  if (!integration.isActive) {
    throw new Error('Avito integration is disabled')
  }

  if (!integration.apiToken || !integration.apiSecret) {
    throw new Error('Avito integration requires Client ID and Client Secret')
  }

  // User ID (profile/account id) часто нужен для Messenger API. Если его нет, попробуем без него.
  const accountIdRaw = integration.accountId ? decrypt(integration.accountId) : ''
  const accountId = accountIdRaw?.trim() || null

  const token = await getAvitoAccessToken({
    clientIdEncrypted: integration.apiToken,
    clientSecretEncrypted: integration.apiSecret,
  })

  const settings = getSettings(integration)

  // Пытаемся получить новые сообщения/обращения.
  // Вариант A (часто встречающийся): messenger/v2/accounts/{user_id}/chats
  // Если accountId не указан, пробуем без него и возвращаем понятную ошибку.
  if (!accountId) {
    throw new Error('Avito sync requires User ID (profile/account id). Укажите его в настройках Авито (USER ID).')
  }

  const chatsUrl = `https://api.avito.ru/messenger/v2/accounts/${encodeURIComponent(accountId)}/chats?limit=${limit}`
  const chatsResp = await avitoFetchJson<{ chats?: any[]; result?: any[]; items?: any[] }>(chatsUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    timeoutMs: 20000,
  })

  if (!chatsResp.ok) {
    throw new Error(`Avito chats error: status=${chatsResp.status} body=${chatsResp.text}`)
  }

  const chats = (chatsResp.data.chats ?? chatsResp.data.result?.chats ?? chatsResp.data.result?.items ?? (Array.isArray(chatsResp.data.result) ? chatsResp.data.result : chatsResp.data.items) ?? []) as any[]
  let processed = 0
  let createdContacts = 0
  let createdDeals = 0
  let skipped = 0

  for (const chat of chats) {
    // Достаём последние сообщения
    const chatId = chat.id ?? chat.chat_id ?? chat.chatId ?? chat.context_id ?? chat.contextId
    if (!chatId) continue

    const messagesUrl = `https://api.avito.ru/messenger/v2/accounts/${encodeURIComponent(
      accountId
    )}/chats/${encodeURIComponent(chatId)}/messages?limit=20`

    const msgResp = await avitoFetchJson<{ messages?: any[]; result?: any[]; items?: any[] }>(messagesUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      timeoutMs: 20000,
    })

    if (!msgResp.ok) {
      // пишем лог и продолжаем
      await prisma.advertisingLog.create({
        data: {
          advertisingId: integration.id,
          payload: { chat, error: msgResp.text },
          response: { error: 'messages_fetch_failed', status: msgResp.status },
          status: 'error',
          errorMessage: `Avito messages error: status=${msgResp.status}`,
        },
      })
      continue
    }

    const messages = (msgResp.data.messages ?? msgResp.data.result?.messages ?? msgResp.data.result?.items ?? (Array.isArray(msgResp.data.result) ? msgResp.data.result : msgResp.data.items) ?? []) as any[]

    for (const message of messages) {
      // Фильтр входящих: пропускаем только если автор точно совпадает с нашим accountId
      // (API может не возвращать author_id — тогда обрабатываем все сообщения)
      const authorId = message.author_id ?? message.author?.id ?? message.user_id ?? null
      if (authorId && accountId && String(authorId).trim() === String(accountId).trim()) {
        skipped++
        continue
      }

      const messageId = String(message.id || message.message_id || `${chatId}:${message.created || message.created_at || ''}`)

      // Дедупликация по AdvertisingLog.leadId
      const existing = await prisma.advertisingLog.findFirst({
        where: { advertisingId: integration.id, leadId: messageId },
        select: { id: true },
      })
      if (existing) {
        skipped++
        continue
      }

      const externalAdId =
        String(chat.itemId || chat.item_id || chat.adId || chat.ad_id || message.itemId || message.item_id || '') || null

      const externalManagerId =
        String(chat.managerId || chat.manager_id || message.managerId || message.manager_id || '') || null

      // Превращаем message/chat в “application” для существующей логики
      const application = {
        id: messageId,
        itemId: externalAdId,
        managerId: externalManagerId,
        phone: message.phone || null,
        email: message.email || null,
        name: message.name || message.author?.name || chat?.user?.name || `Заявка с Авито`,
        text: message.text || message.message || message.body || '',
        comment: message.text || message.message || message.body || '',
      }

      try {
        const result = await processAvitoApplication(application, integration)
        processed++
        if (result.contactCreated) createdContacts++
        if (result.dealCreated) createdDeals++

        await prisma.advertisingLog.create({
          data: {
            advertisingId: integration.id,
            payload: application as any,
            response: { success: true, ...result },
            status: 'success',
            contactId: result.contactId || null,
            dealId: result.dealId || null,
            leadId: messageId,
            campaignId: externalAdId,
          },
        })

        // Обновляем cursor для отображения lastSyncAt (дедупликация — только по leadId)
        settings.avito = { ...(settings.avito || {}), lastSyncAt: new Date().toISOString() }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        await prisma.advertisingLog.create({
          data: {
            advertisingId: integration.id,
            payload: application as any,
            response: { error: msg },
            status: 'error',
            errorMessage: msg,
            leadId: messageId,
            campaignId: externalAdId,
          },
        })
      }
    }
  }

  // persist settings
  await withSettings(integration, settings)

  const result: { processed: number; createdContacts: number; createdDeals: number; skipped: number; debug?: any } = {
    processed,
    createdContacts,
    createdDeals,
    skipped,
  }

  if (debug || processed === 0) {
    result.debug = {
      chatsCount: chats.length,
      hint: chats.length === 0
        ? 'API вернул 0 чатов. Проверьте User ID (номер профиля из портала Авито) и что есть диалоги.'
        : `${chats.length} чатов получено, но обработано 0. Возможные причины: все сообщения от вас (author_id=accountId), все уже в логах.`,
    }
  }

  return result
}

export async function processAvitoApplication(
  application: any,
  integration: any
): Promise<{ contactId?: number; dealId?: number; userId?: number; contactCreated?: boolean; dealCreated?: boolean }> {
  const result: { contactId?: number; dealId?: number; userId?: number; contactCreated?: boolean; dealCreated?: boolean } = {}

  const phone = application.phone || application.phoneNumber || application.tel || null
  const email = application.email || application.emailAddress || null
  const comment = application.comment || application.message || application.text || ''
  const name = application.name || application.fullName || application.clientName || `Заявка с Авито`
  const externalAdId = application.itemId || application.adId || application.ad_id || null
  const externalManagerId = application.managerId || application.manager_id || null

  // выбираем ответственного (если настроено распределение)
  let assignedUserId = pickAssigneeUserId({
    integration,
    externalManagerId: externalManagerId ? String(externalManagerId) : null,
    externalAdId: externalAdId ? String(externalAdId) : null,
  })

  // Находим или создаем контакт
  let contact: any = null
  let isNewContact = false

  if (phone || email) {
    const whereConditions: any[] = []
    if (phone) whereConditions.push({ phone })
    if (email) whereConditions.push({ email })

    const existing = await prisma.contact.findFirst({
      where: {
        OR: whereConditions,
        user: { companyId: integration.companyId },
      },
    })

    if (existing) {
      contact = await prisma.contact.update({
        where: { id: existing.id },
        data: {
          name: name || existing.name,
          phone: phone || existing.phone,
          email: email || existing.email,
          userId: existing.userId || assignedUserId || null,
        },
      })
    } else if (integration.autoCreateContact) {
      if (!assignedUserId) {
        const fallbackUser = await prisma.user.findFirst({
          where: { companyId: integration.companyId },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        })
        assignedUserId = fallbackUser?.id || null
      }

      if (!assignedUserId) {
        throw new Error('Cannot create contact: no user available in company')
      }

      contact = await prisma.contact.create({
        data: {
          name,
          phone,
          email,
          userId: assignedUserId,
        },
      })
      isNewContact = true
      result.contactCreated = true
    }
  } else if (integration.autoCreateContact) {
    // Если Avito не даёт телефон/email, создаём контакт-заглушку по id заявки
    if (!assignedUserId) {
      const fallbackUser = await prisma.user.findFirst({
        where: { companyId: integration.companyId },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      })
      assignedUserId = fallbackUser?.id || null
    }
    if (assignedUserId) {
      contact = await prisma.contact.create({
        data: {
          name,
          phone: null,
          email: null,
          userId: assignedUserId,
        },
      })
      isNewContact = true
      result.contactCreated = true
    }
  }

  if (contact) {
    result.contactId = contact.id
    result.userId = contact.userId || assignedUserId || undefined

    // Создаем сделку, если нужно
    if (integration.autoCreateDeal && integration.defaultPipelineId) {
      const pipeline = await prisma.pipeline.findFirst({
        where: { id: integration.defaultPipelineId, companyId: integration.companyId },
        select: { stages: true },
      })

      if (pipeline) {
        const stages = parsePipelineStages(pipeline.stages)
        const initialStage = stages[0]?.name || 'Новый лид'
        const dealTitle = comment ? `Заявка с Авито: ${comment.substring(0, 50)}` : `Заявка с Авито: ${name}`

        let dealUserId: number | null = contact.userId || assignedUserId || null
        if (!dealUserId) {
          const fallbackUser = await prisma.user.findFirst({
            where: { companyId: integration.companyId },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
          })
          dealUserId = fallbackUser?.id || null
        }

        if (dealUserId && typeof dealUserId === 'number') {
          const deal = await prisma.deal.create({
            data: {
              title: dealTitle,
              amount: 0,
              currency: 'RUB',
              stage: initialStage,
              contactId: contact.id,
              userId: dealUserId,
              pipelineId: integration.defaultPipelineId,
              sourceId: integration.defaultSourceId,
            },
          })
          result.dealId = deal.id
          result.dealCreated = true

          await processAutomations('DEAL_CREATED', {
            dealId: deal.id,
            contactId: contact.id,
            userId: dealUserId,
            companyId: integration.companyId,
          })
        }
      }
    }

    if (isNewContact) {
      await processAutomations('CONTACT_CREATED', {
        contactId: contact.id,
        userId: contact.userId || undefined,
        companyId: integration.companyId,
      })
    }
  }

  return result
}

