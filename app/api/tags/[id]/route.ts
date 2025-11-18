import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'

// PUT /api/tags/[id] - обновить тег
export async function PUT(
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
    const { name, color } = body

    const companyId = Number(currentUser.companyId)
    const tag = await prisma.tag.findUnique({
      where: { id: parseInt(id) },
    })

    if (!tag || tag.companyId !== companyId) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    const updatedTag = await prisma.tag.update({
      where: { id: parseInt(id) },
      data: {
        name: name ? name.trim() : undefined,
        color: color || undefined,
      },
    })

    return NextResponse.json({ tag: updatedTag })
  } catch (error: any) {
    console.error('Error updating tag:', error)
    return NextResponse.json(
      { error: 'Failed to update tag' },
      { status: 500 }
    )
  }
}

// DELETE /api/tags/[id] - удалить тег
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
    const companyId = Number(currentUser.companyId)
    const tag = await prisma.tag.findUnique({
      where: { id: parseInt(id) },
    })

    if (!tag || tag.companyId !== companyId) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    // Удаляем тег (связи удалятся каскадно)
    await prisma.tag.delete({
      where: { id: parseInt(id) },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting tag:', error)
    return NextResponse.json(
      { error: 'Failed to delete tag' },
      { status: 500 }
    )
  }
}

