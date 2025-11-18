import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { price: 'asc' },
    })

    return NextResponse.json({ plans })
  } catch (error) {
    console.error('[billing][plans]', error)
    return NextResponse.json({ error: 'Failed to load plans' }, { status: 500 })
  }
}

