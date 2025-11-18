import { NextResponse } from 'next/server'
import { getCurrentUser, getUserId } from '@/lib/get-session'
import prisma from '@/lib/prisma'

// GET /api/contacts/[id]/tags - получить теги контакта
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
    const contact = await prisma.contact.findUnique({
      where: { id: parseInt(id) },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Проверяем доступ
    const userId = getUserId(currentUser)
    if (contact.userId !== userId && currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const tags = contact.tags.map((ct) => ct.tag)
    return NextResponse.json({ tags })
  } catch (error: any) {
    console.error('Error fetching contact tags:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
      { status: 500 }
    )
  }
}

// POST /api/contacts/[id]/tags - добавить тег к контакту
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

    const contact = await prisma.contact.findUnique({
      where: { id: parseInt(id) },
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Проверяем доступ
    const userId = getUserId(currentUser)
    if (contact.userId !== userId && currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
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
      const contactTag = await prisma.contactTag.create({
        data: {
          contactId: parseInt(id),
          tagId: parseInt(tagId),
        },
        include: {
          tag: true,
        },
      })

      return NextResponse.json({ tag: contactTag.tag }, { status: 201 })
    } catch (error: any) {
      // Если тег уже добавлен, возвращаем существующий
      if (error.code === 'P2002') {
        const existing = await prisma.contactTag.findUnique({
          where: {
            contactId_tagId: {
              contactId: parseInt(id),
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
    console.error('Error adding tag to contact:', error)
    return NextResponse.json(
      { error: 'Failed to add tag' },
      { status: 500 }
    )
  }
}

// DELETE /api/contacts/[id]/tags?tagId=1 - удалить тег у контакта
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

    const contact = await prisma.contact.findUnique({
      where: { id: parseInt(id) },
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Проверяем доступ
    const userId = getUserId(currentUser)
    if (contact.userId !== userId && currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    await prisma.contactTag.delete({
      where: {
        contactId_tagId: {
          contactId: parseInt(id),
          tagId: parseInt(tagId),
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error removing tag from contact:', error)
    return NextResponse.json(
      { error: 'Failed to remove tag' },
      { status: 500 }
    )
  }
}

