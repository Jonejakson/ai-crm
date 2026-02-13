import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'
import { ensureDefaultPlans } from '@/lib/billing-setup'
import { json } from '@/lib/json-response'

/**
 * Принудительно перезаписать описания и features планов из кода (UTF-8).
 * ensureDefaultPlans при наличии планов вызывает syncPlanDescriptions — исправляет кракозябры в БД.
 * Доступ: авторизованный пользователь (любой).
 */
export async function POST() {
  const user = await getCurrentUser()
  if (!user) {
    return json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await ensureDefaultPlans(prisma)
    return json({ ok: true, message: 'Описания тарифов обновлены' })
  } catch (error) {
    console.error('[billing][plans][sync]', error)
    return json({ error: 'Failed to sync plan descriptions' }, { status: 500 })
  }
}
