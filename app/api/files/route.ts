import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'
import { getDirectWhereCondition } from '@/lib/access-control'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { deleteFileFromS3, isS3Configured } from '@/lib/storage'

/**
 * Получить файлы для сущности
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'entityType and entityId are required' },
        { status: 400 }
      )
    }

    // Проверяем доступ к сущности
    const entityIdNum = parseInt(entityId)
    const whereCondition = await getDirectWhereCondition()

    let hasAccess = false
    switch (entityType) {
      case 'contact':
        hasAccess = !!(await prisma.contact.findFirst({
          where: { id: entityIdNum, ...whereCondition },
        }))
        break
      case 'deal':
        hasAccess = !!(await prisma.deal.findFirst({
          where: { id: entityIdNum, ...whereCondition },
        }))
        break
      case 'task':
        hasAccess = !!(await prisma.task.findFirst({
          where: { id: entityIdNum, ...whereCondition },
        }))
        break
      case 'event':
        hasAccess = !!(await prisma.event.findFirst({
          where: { id: entityIdNum, ...whereCondition },
        }))
        break
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Получаем файлы
    const files = await prisma.file.findMany({
      where: {
        entityType,
        entityId: entityIdNum,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ files })
  } catch (error: any) {
    console.error('[files][GET]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load files' },
      { status: 500 }
    )
  }
}

/**
 * Удалить файл
 */
export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('id')

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 })
    }

    // Получаем файл
    const file = await prisma.file.findUnique({
      where: { id: parseInt(fileId) },
      include: {
        user: true,
      },
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Проверяем доступ (только владелец или админ)
    const userId = parseInt(user.id)
    if (file.userId !== userId && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Удаляем файл из хранилища
    try {
      if (isS3Configured() && file.url.startsWith('http')) {
        // Файл в S3
        const s3Key = `${file.entityType}/${file.entityId}/${file.name}`
        await deleteFileFromS3(s3Key)
      } else {
        // Локальный файл
        const filePath = join(process.cwd(), 'public', file.url)
        await unlink(filePath)
      }
    } catch (error) {
      console.error('Error deleting file from storage:', error)
      // Продолжаем даже если файл не найден
    }

    // Удаляем запись из БД
    await prisma.file.delete({
      where: { id: parseInt(fileId) },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[files][DELETE]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete file' },
      { status: 500 }
    )
  }
}

