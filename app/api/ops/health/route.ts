import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const startedAt = new Date().toISOString()

export async function GET() {
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


