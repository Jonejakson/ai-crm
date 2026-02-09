import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import { debugAvito } from '@/lib/advertising/avito'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const companyId = parseInt(user.companyId)
    const result = await debugAvito({ companyId })
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
