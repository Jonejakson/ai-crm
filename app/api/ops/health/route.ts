import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'

const startedAt = new Date().toISOString()

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Только owner имеет доступ к операционному мониторингу
  if (user.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden: Owner only' }, { status: 403 })
  }

  try {
    // простой пинг БД
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      ok: true,
      startedAt,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[health]', error)
    return NextResponse.json(
      {
        ok: false,
        error: 'db_failed',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}


