import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { getCurrentUser, getUserId } from '@/lib/get-session'
import prisma from '@/lib/prisma'
import { getDirectWhereCondition } from '@/lib/access-control'
import { uploadFileToS3, isS3Configured } from '@/lib/storage'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads')

/**
 * Загрузить файл
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const entityType = formData.get('entityType') as string
    const entityId = formData.get('entityId') as string

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'entityType and entityId are required' },
        { status: 400 }
      )
    }

    // Проверка размера файла
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      )
    }

    // Проверка доступа к сущности
    const entityIdNum = parseInt(entityId)
    let hasAccess = false

    switch (entityType) {
      case 'contact': {
        const whereCondition = await getDirectWhereCondition()
        const contact = await prisma.contact.findFirst({
          where: { id: entityIdNum, ...whereCondition },
        })
        hasAccess = !!contact
        break
      }
      case 'deal': {
        const whereCondition = await getDirectWhereCondition()
        const deal = await prisma.deal.findFirst({
          where: { id: entityIdNum, ...whereCondition },
        })
        hasAccess = !!deal
        break
      }
      case 'task': {
        const whereCondition = await getDirectWhereCondition()
        const task = await prisma.task.findFirst({
          where: { id: entityIdNum, ...whereCondition },
        })
        hasAccess = !!task
        break
      }
      case 'event': {
        const whereCondition = await getDirectWhereCondition()
        const event = await prisma.event.findFirst({
          where: { id: entityIdNum, ...whereCondition },
        })
        hasAccess = !!event
        break
      }
      case 'support_ticket_message': {
        // Для файлов тикетов - проверяем доступ через userId файла или роль owner
        // Упрощенная проверка - файлы доступны только owner или владельцу файла
        hasAccess = user.role === 'owner'
        break
      }
      default:
        return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 })
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Генерируем уникальное имя файла
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop()
    const fileName = `${timestamp}_${randomStr}.${fileExtension}`

    // Получаем содержимое файла
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    let fileUrl: string

    // Используем S3 если настроено, иначе локальное хранилище
    if (isS3Configured()) {
      try {
        // Загружаем в S3
        // Используем префикс для организации файлов по типам сущностей
        const s3Key = `${entityType}/${entityId}/${fileName}`
        fileUrl = await uploadFileToS3(s3Key, buffer, file.type)
      } catch (s3Error: any) {
        console.error('[files][upload] S3 upload error:', s3Error)
        // Fallback на локальное хранилище при ошибке S3
        const filePath = join(UPLOAD_DIR, fileName)
        try {
          await mkdir(UPLOAD_DIR, { recursive: true })
          await writeFile(filePath, buffer)
          fileUrl = `/uploads/${fileName}`
        } catch (localError) {
          throw new Error('Failed to upload file to both S3 and local storage')
        }
      }
    } else {
      // Локальное хранилище
      try {
        await mkdir(UPLOAD_DIR, { recursive: true })
      } catch (error) {
        // Директория уже существует
      }
      const filePath = join(UPLOAD_DIR, fileName)
      await writeFile(filePath, buffer)
      fileUrl = `/uploads/${fileName}`
    }

    // Сохраняем информацию о файле в БД
    const userId = getUserId(user)
    const fileRecord = await prisma.file.create({
      data: {
        name: fileName,
        originalName: file.name,
        url: fileUrl,
        size: file.size,
        mimeType: file.type,
        entityType,
        entityId: entityIdNum,
        userId: userId || undefined,
        messageId: entityType === 'support_ticket_message' ? entityIdNum : undefined,
      },
    })

    return NextResponse.json({ file: fileRecord })
  } catch (error: any) {
    console.error('[files][upload][POST]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload file' },
      { status: 500 }
    )
  }
}

