import prisma from '@/lib/prisma'
import { ensureDefaultPlans } from '@/lib/billing-setup'
import { json } from '@/lib/json-response'

export async function GET() {
  try {
    await ensureDefaultPlans(prisma)
    const plans = await prisma.plan.findMany({
      orderBy: { price: 'asc' },
    })
    const res = json({ plans })
    res.headers.set('Cache-Control', 'no-store, max-age=0')
    return res
  } catch (error) {
    console.error('[billing][plans]', error)
    return json({ error: 'Failed to load plans' }, { status: 500 })
  }
}

