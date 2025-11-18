import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import { getCompanyLimitsUsage } from '@/lib/subscription-limits'

/**
 * Получить информацию об использовании лимитов компании
 */
export async function GET() {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const companyId = Number(currentUser.companyId)
    const limitsUsage = await getCompanyLimitsUsage(companyId)

    if (!limitsUsage) {
      return NextResponse.json({ error: 'Не удалось получить информацию о лимитах' }, { status: 500 })
    }

    return NextResponse.json({ limitsUsage })
  } catch (error) {
    console.error('[billing][limits][GET]', error)
    return NextResponse.json({ error: 'Failed to load limits' }, { status: 500 })
  }
}

