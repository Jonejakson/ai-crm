import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'
import { decrypt } from '@/lib/encryption'

function normalizeMoyskladSecret(input: string): string {
  let s = (input || '').trim()
  if (!s) return s
  s = s.replace(/^(Bearer|Token)\s+/i, '').trim()
  if (s.startsWith('{') && s.endsWith('}')) {
    try {
      const obj: any = JSON.parse(s)
      const candidate =
        obj?.token ??
        obj?.access_token ??
        obj?.accessToken ??
        obj?.apiKey ??
        obj?.apikey ??
        obj?.api_key ??
        obj?.password
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
    } catch {
      // ignore
    }
  }
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }
  return s
}

// Список сотрудников МойСклад (для маппинга владельца/ответственного)
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const companyId = parseInt(user.companyId)
    const integration = await prisma.accountingIntegration.findFirst({
      where: {
        companyId,
        platform: 'MOYSKLAD',
        isActive: true,
        apiToken: { not: null },
        apiSecret: { not: null },
      },
    })

    if (!integration?.apiToken || !integration.apiSecret) {
      return NextResponse.json({ error: 'МойСклад интеграция не настроена' }, { status: 404 })
    }

    const apiSecret = normalizeMoyskladSecret(await decrypt(integration.apiSecret))
    const apiToken = integration.apiToken
    const authString = Buffer.from(`${apiToken}:${apiSecret}`).toString('base64')
    const baseUrl = 'https://api.moysklad.ru/api/remap/1.2'

    const resp = await fetch(`${baseUrl}/entity/employee?limit=1000`, {
      headers: {
        Authorization: `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData?.errors?.[0]?.error || 'Не удалось получить сотрудников МойСклад' },
        { status: 502 }
      )
    }

    const data = await resp.json()
    const rows = Array.isArray(data?.rows) ? data.rows : []

    return NextResponse.json(
      rows.map((e: any) => ({
        id: String(e.id),
        name: String(e.name || ''),
        email: e.email ? String(e.email) : null,
        archived: Boolean(e.archived),
      }))
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[moysklad][employees]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

