import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/get-session'
import { isAdmin } from '@/lib/access-control'
import type { RolePermissionsMap } from '@/lib/permissions'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const companyId = parseInt(user.companyId ?? '')
    if (Number.isNaN(companyId) || companyId <= 0) {
      return NextResponse.json({ rolePermissions: null })
    }
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { rolePermissions: true },
    })

    const rolePermissions = (company?.rolePermissions as unknown as RolePermissionsMap) ?? null
    return NextResponse.json({ rolePermissions })
  } catch (error: any) {
    console.error('Error fetching role permissions:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const rolePermissions = body.rolePermissions as RolePermissionsMap
    if (!rolePermissions || typeof rolePermissions !== 'object') {
      return NextResponse.json({ error: 'Invalid rolePermissions' }, { status: 400 })
    }

    const companyId = parseInt(user.companyId ?? '')
    if (Number.isNaN(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'Invalid company' }, { status: 400 })
    }
    await prisma.company.update({
      where: { id: companyId },
      data: { rolePermissions: rolePermissions as unknown as Prisma.InputJsonValue },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating role permissions:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
