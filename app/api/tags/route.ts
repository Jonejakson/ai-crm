import { NextResponse } from 'next/server'
import { getCurrentUser, getUserId } from '@/lib/get-session'
import prisma from '@/lib/prisma'

// GET /api/tags - получить все теги компании
export async function GET(req: Request) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyId = Number(currentUser.companyId)
    const tags = await prisma.tag.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ tags })
  } catch (error: any) {
    console.error('Error fetching tags:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
      { status: 500 }
    )
  }
}

// POST /api/tags - создать новый тег
export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, color } = body

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      )
    }

    const companyId = Number(currentUser.companyId)
    
    // Проверяем, нет ли уже тега с таким именем в компании
    const existingTag = await prisma.tag.findFirst({
      where: {
        companyId,
        name: name.trim(),
      },
    })

    if (existingTag) {
      return NextResponse.json(
        { error: 'Tag with this name already exists' },
        { status: 400 }
      )
    }

    const tag = await prisma.tag.create({
      data: {
        name: name.trim(),
        color: color || '#3B82F6',
        companyId,
      },
    })

    return NextResponse.json({ tag }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating tag:', error)
    return NextResponse.json(
      { error: 'Failed to create tag' },
      { status: 500 }
    )
  }
}

