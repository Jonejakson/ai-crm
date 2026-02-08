import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import { hasActiveSubscription } from '@/lib/subscription-limits'

/**
 * Возвращает, есть ли у компании действующая подписка.
 * Используется в UI для скрытия кнопок создания при истекшей подписке.
 */
export async function GET() {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const companyId = Number(currentUser.companyId)
  if (!companyId) {
    return NextResponse.json({ active: false })
  }

  const active = await hasActiveSubscription(companyId)
  return NextResponse.json({ active })
}
