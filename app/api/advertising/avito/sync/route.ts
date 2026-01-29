import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import { syncAvito } from '@/lib/advertising/avito'

// Ручная синхронизация Авито (polling)
export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const companyId = parseInt(user.companyId)
    const result = await syncAvito({ companyId })
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

