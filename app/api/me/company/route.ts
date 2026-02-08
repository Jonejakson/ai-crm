import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'

/** Название компании и флаг юр. лица для текущего пользователя (для header) */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const companyId = Number(user.companyId)
  if (!companyId || Number.isNaN(companyId)) {
    return NextResponse.json({ name: null, isLegalEntity: false })
  }

  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, isLegalEntity: true },
    })
    return NextResponse.json({
      name: company?.name ?? null,
      isLegalEntity: company?.isLegalEntity ?? false,
    })
  } catch (error) {
    console.error('[me/company]', error)
    return NextResponse.json({ name: null, isLegalEntity: false })
  }
}
