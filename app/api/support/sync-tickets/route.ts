import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import { isOwner } from '@/lib/owner'
import { isSupportEmailConfigured } from '@/lib/support/config'

export async function POST() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (user.role !== 'owner' && !isOwner(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isSupportEmailConfigured()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: 'Почта поддержки не настроена',
    })
  }

  return NextResponse.json({
    ok: true,
    skipped: true,
    message: 'Синхронизация пока не настроена в текущей версии',
  })
}
