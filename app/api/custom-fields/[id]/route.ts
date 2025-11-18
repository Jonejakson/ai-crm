import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'
import { Prisma } from '@prisma/client'

// GET - получить кастомное поле по ID
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
    const customField = await prisma.customField.findUnique({
      where: { id: parseInt(id) },
    })

    if (!customField) {
      return NextResponse.json(
        { error: 'Custom field not found' },
        { status: 404 }
      )
    }

    // Проверка доступа к полю компании
    if (customField.companyId !== Number(currentUser.companyId)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      ...customField,
      options: customField.options ? JSON.parse(customField.options as string) : null,
    })
  } catch (error: any) {
    console.error('Error fetching custom field:', error)
    return NextResponse.json(
      { error: 'Failed to fetch custom field' },
      { status: 500 }
    )
  }
}

// PUT - обновить кастомное поле
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Только админ может обновлять кастомные поля
    if (currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can update custom fields' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const {
      name,
      type,
      isRequired,
      isUnique,
      order,
      options,
      defaultValue,
    } = body

    // Проверка существования поля
    const existing = await prisma.customField.findUnique({
      where: { id: parseInt(id) },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Custom field not found' },
        { status: 404 }
      )
    }

    // Проверка доступа
    if (existing.companyId !== Number(currentUser.companyId)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Проверка уникальности имени (если изменилось)
    if (name && name !== existing.name) {
      const duplicate = await prisma.customField.findFirst({
        where: {
          companyId: Number(currentUser.companyId),
          entityType: existing.entityType,
          name,
          id: { not: parseInt(id) },
        },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: 'Custom field with this name already exists' },
          { status: 400 }
        )
      }
    }

    // Валидация опций для SELECT и MULTISELECT
    if ((type === 'SELECT' || type === 'MULTISELECT') && (!options || !Array.isArray(options) || options.length === 0)) {
      return NextResponse.json(
        { error: 'Options are required for SELECT and MULTISELECT types' },
        { status: 400 }
      )
    }

    const updated = await prisma.customField.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(isRequired !== undefined && { isRequired }),
        ...(isUnique !== undefined && { isUnique }),
        ...(order !== undefined && { order }),
        ...(options !== undefined && { options: options ? JSON.stringify(options) : Prisma.JsonNull }),
        ...(defaultValue !== undefined && { defaultValue }),
      },
    })

    return NextResponse.json({
      ...updated,
      options: updated.options ? JSON.parse(updated.options as string) : null,
    })
  } catch (error: any) {
    console.error('Error updating custom field:', error)
    return NextResponse.json(
      { error: 'Failed to update custom field' },
      { status: 500 }
    )
  }
}

// DELETE - удалить кастомное поле
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Только админ может удалять кастомные поля
    if (currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can delete custom fields' },
        { status: 403 }
      )
    }

    const { id } = await params

    // Проверка существования поля
    const existing = await prisma.customField.findUnique({
      where: { id: parseInt(id) },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Custom field not found' },
        { status: 404 }
      )
    }

    // Проверка доступа
    if (existing.companyId !== Number(currentUser.companyId)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Удаление поля (значения удалятся каскадно)
    await prisma.customField.delete({
      where: { id: parseInt(id) },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting custom field:', error)
    return NextResponse.json(
      { error: 'Failed to delete custom field' },
      { status: 500 }
    )
  }
}

