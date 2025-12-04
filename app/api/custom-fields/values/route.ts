import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'

// GET - получить значения кастомных полей для сущности
export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType') // contact, deal, task
    const entityId = searchParams.get('entityId')

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'entityType and entityId are required' },
        { status: 400 }
      )
    }

    // Получаем все кастомные поля для этого типа сущности
    const customFields = await prisma.customField.findMany({
      where: {
        companyId: Number(currentUser.companyId),
        entityType,
      },
      orderBy: [
        { order: 'asc' },
        { createdAt: 'asc' },
      ],
    })

    // Получаем значения для этой сущности
    const values = await prisma.customFieldValue.findMany({
      where: {
        entityType,
        entityId: parseInt(entityId),
        customField: {
          companyId: Number(currentUser.companyId),
        },
      },
      include: {
        customField: true,
      },
    })

    // Формируем результат: все поля с их значениями
    const result = customFields.map((field) => {
      const value = values.find((v) => v.customFieldId === field.id)
      return {
        field: {
          id: field.id,
          name: field.name,
          type: field.type,
          isRequired: field.isRequired,
          isUnique: field.isUnique,
          options: field.options ? JSON.parse(field.options as string) : null,
          defaultValue: field.defaultValue,
        },
        value: value
          ? {
              id: value.id,
              value: value.value,
              // Парсим JSON для MULTISELECT
              parsedValue:
                field.type === 'MULTISELECT' && value.value
                  ? JSON.parse(value.value)
                  : value.value,
            }
          : null,
      }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching custom field values:', error)
    return NextResponse.json(
      { error: 'Failed to fetch custom field values' },
      { status: 500 }
    )
  }
}

// PUT - сохранить значения кастомных полей для сущности
export async function PUT(request: Request) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { entityType, entityId, values } = body

    if (!entityType || !entityId || !values || !Array.isArray(values)) {
      return NextResponse.json(
        { error: 'entityType, entityId, and values array are required' },
        { status: 400 }
      )
    }

    // Проверка доступа к сущности (зависит от типа)
    // Здесь можно добавить проверки для каждого типа сущности

    const results = []

    for (const item of values) {
      const { fieldId, value } = item

      if (!fieldId) continue

      // Получаем определение поля
      const field = await prisma.customField.findUnique({
        where: { id: fieldId },
      })

      if (!field || field.companyId !== Number(currentUser.companyId)) {
        continue
      }

      // Валидация обязательных полей
      if (field.isRequired && (!value || value === '')) {
        return NextResponse.json(
          { error: `Field "${field.name}" is required` },
          { status: 400 }
        )
      }

      // Подготовка значения
      let processedValue: string | null = null
      if (value !== null && value !== undefined && value !== '') {
        if (field.type === 'MULTISELECT' && Array.isArray(value)) {
          processedValue = JSON.stringify(value)
        } else {
          processedValue = value.toString()
        }
      }

      // Валидация уникальности
      if (field.isUnique && processedValue) {
        const existing = await prisma.customFieldValue.findFirst({
          where: {
            customFieldId: fieldId,
            entityType,
            value: processedValue,
            NOT: {
              entityId: parseInt(entityId),
            },
          },
        })

        if (existing) {
          return NextResponse.json(
            { error: `Field "${field.name}" must be unique` },
            { status: 400 }
          )
        }
      }

      // Поиск существующего значения
      const existingValue = await prisma.customFieldValue.findFirst({
        where: {
          customFieldId: fieldId,
          entityType,
          entityId: parseInt(entityId),
        },
      })

      if (existingValue) {
        // Обновление существующего значения
        if (processedValue === null) {
          // Удаление значения, если оно пустое
          await prisma.customFieldValue.delete({
            where: { id: existingValue.id },
          })
          results.push({ fieldId, value: null })
        } else {
          const updated = await prisma.customFieldValue.update({
            where: { id: existingValue.id },
            data: { value: processedValue },
          })
          results.push({
            fieldId,
            value:
              field.type === 'MULTISELECT'
                ? JSON.parse(updated.value || '[]')
                : updated.value,
          })
        }
      } else if (processedValue !== null) {
        // Создание нового значения
        const created = await prisma.customFieldValue.create({
          data: {
            customFieldId: fieldId,
            entityType,
            entityId: parseInt(entityId),
            value: processedValue,
          },
        })
        results.push({
          fieldId,
          value:
            field.type === 'MULTISELECT'
              ? JSON.parse(created.value || '[]')
              : created.value,
        })
      }
    }

    return NextResponse.json({ success: true, values: results })
  } catch (error: any) {
    console.error('Error saving custom field values:', error)
    return NextResponse.json(
      { error: 'Failed to save custom field values' },
      { status: 500 }
    )
  }
}

