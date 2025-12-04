import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'
import { Prisma } from '@prisma/client'

// GET - получить все кастомные поля компании
export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType') // contact, deal, task

    const where: any = {
      companyId: Number(currentUser.companyId),
    }

    if (entityType) {
      where.entityType = entityType
    }

    const customFields = await prisma.customField.findMany({
      where,
      orderBy: [
        { order: 'asc' },
        { createdAt: 'asc' },
      ],
    })

    return NextResponse.json(customFields)
  } catch (error: any) {
    console.error('Error fetching custom fields:', error)
    return NextResponse.json(
      { error: 'Failed to fetch custom fields' },
      { status: 500 }
    )
  }
}

// POST - создать новое кастомное поле
export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Только админ может создавать кастомные поля
    if (currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can create custom fields' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      name,
      type,
      entityType,
      isRequired = false,
      isUnique = false,
      order = 0,
      options,
      defaultValue,
    } = body

    if (!name || !type || !entityType) {
      return NextResponse.json(
        { error: 'Name, type, and entityType are required' },
        { status: 400 }
      )
    }

    // Проверка уникальности имени в рамках компании и типа сущности
    const existing = await prisma.customField.findFirst({
      where: {
        companyId: Number(currentUser.companyId),
        entityType,
        name,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Custom field with this name already exists' },
        { status: 400 }
      )
    }

    // Валидация опций для SELECT и MULTISELECT
    if ((type === 'SELECT' || type === 'MULTISELECT') && (!options || !Array.isArray(options) || options.length === 0)) {
      return NextResponse.json(
        { error: 'Options are required for SELECT and MULTISELECT types' },
        { status: 400 }
      )
    }

    const customField = await prisma.customField.create({
      data: {
        name,
        type,
        entityType,
        isRequired,
        isUnique,
        order,
        options: options ? JSON.stringify(options) : Prisma.JsonNull,
        defaultValue,
        companyId: Number(currentUser.companyId),
      },
    })

    return NextResponse.json({
      ...customField,
      options: customField.options ? JSON.parse(customField.options as string) : null,
    })
  } catch (error: any) {
    console.error('Error creating custom field:', error)
    return NextResponse.json(
      { error: 'Failed to create custom field' },
      { status: 500 }
    )
  }
}

