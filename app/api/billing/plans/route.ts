import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ensureDefaultPlans } from '@/lib/billing-setup'

export async function GET() {
  try {
    await ensureDefaultPlans(prisma)
    const plans = await prisma.plan.findMany({
      orderBy: { price: 'asc' },
    })

    return NextResponse.json({ plans })
  } catch (error) {
    console.error('[billing][plans]', error)
    return NextResponse.json({ error: 'Failed to load plans' }, { status: 500 })
  }
}

