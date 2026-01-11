import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'
import { getFileFromS3, isS3Configured } from '@/lib/storage'

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads')

type RouteContext = {
  params: Promise<{ filename: string }>
}

/**
 * Получить файл по имени
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { filename } = await context.params

    // Проверяем, что файл существует в БД и у пользователя есть доступ
    const fileRecord = await prisma.file.findFirst({
      where: {
        name: filename,
      },
    })

    if (!fileRecord) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Проверка доступа: owner видит все, пользователь - только свои файлы
    if (user.role !== 'owner' && fileRecord.userId !== Number(user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Получаем файл
    let fileBuffer: Buffer
    try {
      // Проверяем, используется ли S3
      // Если URL начинается с http или S3 настроено, пробуем получить из S3
      if (isS3Configured()) {
        try {
          // Файл в S3 - используем структуру entityType/entityId/filename
          const s3Key = `${fileRecord.entityType}/${fileRecord.entityId}/${filename}`
          fileBuffer = await getFileFromS3(s3Key)
        } catch (s3Error) {
          // Если не найден в S3, пробуем локальное хранилище (fallback)
          console.warn('[files][GET] File not found in S3, trying local storage:', s3Error)
          const filePath = join(UPLOAD_DIR, filename)
          fileBuffer = await readFile(filePath)
        }
      } else {
        // Локальный файл
        const filePath = join(UPLOAD_DIR, filename)
        fileBuffer = await readFile(filePath)
      }

      // Определяем Content-Type
      const contentType = fileRecord.mimeType || 'application/octet-stream'

      // Возвращаем файл с правильными заголовками
      // Конвертируем Buffer в Uint8Array для NextResponse
      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${encodeURIComponent(fileRecord.originalName)}"`,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    } catch (fileError) {
      console.error('[files][GET] File read error:', fileError)
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
  } catch (error: any) {
    console.error('[files][GET]', error)
    return NextResponse.json({ error: 'Failed to get file' }, { status: 500 })
  }
}

