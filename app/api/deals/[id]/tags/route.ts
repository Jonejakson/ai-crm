import { NextResponse } from 'next/server'
import { getCurrentUser, getUserId } from '@/lib/get-session'
import prisma from '@/lib/prisma'

// GET /api/deals/[id]/tags - получить теги сделки
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const deal = await prisma.deal.findUnique({
      where: { id: parseInt(id) },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        user: {
          select: { companyId: true },
        },
      },
    })

    if (!deal || deal.user.companyId !== Number(currentUser.companyId)) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    const tags = deal.tags.map((dt) => dt.tag)
    return NextResponse.json({ tags })
  } catch (error: any) {
    console.error('Error fetching deal tags:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
      { status: 500 }
    )
  }
}

// POST /api/deals/[id]/tags - добавить тег к сделке
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { tagId } = body

    if (!tagId) {
      return NextResponse.json(
        { error: 'tagId is required' },
        { status: 400 }
      )
    }

    const deal = await prisma.deal.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: {
          select: { companyId: true },
        },
      },
    })

    if (!deal || deal.user.companyId !== Number(currentUser.companyId)) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // Проверяем, что тег принадлежит компании
    const companyId = Number(currentUser.companyId)
    const tag = await prisma.tag.findUnique({
      where: { id: parseInt(tagId) },
    })

    if (!tag || tag.companyId !== companyId) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    // Добавляем тег (если еще не добавлен)
    try {
      const dealTag = await prisma.dealTag.create({
        data: {
          dealId: parseInt(id),
          tagId: parseInt(tagId),
        },
        include: {
          tag: true,
        },
      })

      return NextResponse.json({ tag: dealTag.tag }, { status: 201 })
    } catch (error: any) {
      // Если тег уже добавлен, возвращаем существующий
      if (error.code === 'P2002') {
        const existing = await prisma.dealTag.findUnique({
          where: {
            dealId_tagId: {
              dealId: parseInt(id),
              tagId: parseInt(tagId),
            },
          },
          include: {
            tag: true,
          },
        })
        return NextResponse.json({ tag: existing?.tag })
      }
      throw error
    }
  } catch (error: any) {
    console.error('Error adding tag to deal:', error)
    return NextResponse.json(
      { error: 'Failed to add tag' },
      { status: 500 }
    )
  }
}

// DELETE /api/deals/[id]/tags?tagId=1 - удалить тег у сделки
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const tagId = searchParams.get('tagId')

    if (!tagId) {
      return NextResponse.json(
        { error: 'tagId is required' },
        { status: 400 }
      )
    }

    const deal = await prisma.deal.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: {
          select: { companyId: true },
        },
      },
    })

    if (!deal || deal.user.companyId !== Number(currentUser.companyId)) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    await prisma.dealTag.delete({
      where: {
        dealId_tagId: {
          dealId: parseInt(id),
          tagId: parseInt(tagId),
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error removing tag from deal:', error)
    return NextResponse.json(
      { error: 'Failed to remove tag' },
      { status: 500 }
    )
  }
}

