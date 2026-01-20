import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'
import { getFileFromS3, isS3Configured } from '@/lib/storage'
import { getDirectWhereCondition } from '@/lib/access-control'

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

    // Проверка доступа: owner видит всё. Для остальных проверяем доступ к сущности,
    // чтобы файлы были доступны всем пользователям компании, имеющим доступ к deal/contact/task/event.
    if (user.role !== 'owner') {
      const whereCondition = await getDirectWhereCondition()
      let hasAccess = false

      switch (fileRecord.entityType) {
        case 'contact':
          hasAccess = !!(await prisma.contact.findFirst({
            where: { id: Number(fileRecord.entityId), ...whereCondition },
            select: { id: true },
          }))
          break
        case 'deal':
          hasAccess = !!(await prisma.deal.findFirst({
            where: { id: Number(fileRecord.entityId), ...whereCondition },
            select: { id: true },
          }))
          break
        case 'task':
          hasAccess = !!(await prisma.task.findFirst({
            where: { id: Number(fileRecord.entityId), ...whereCondition },
            select: { id: true },
          }))
          break
        case 'event':
          hasAccess = !!(await prisma.event.findFirst({
            where: { id: Number(fileRecord.entityId), ...whereCondition },
            select: { id: true },
          }))
          break
        case 'support_ticket_message':
          // Пока только owner
          hasAccess = false
          break
        default:
          hasAccess = false
      }

      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
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

      const isDownload = request.nextUrl.searchParams.get('download') === '1'
      const dispositionType = isDownload ? 'attachment' : 'inline'

      // Возвращаем файл с правильными заголовками
      // Конвертируем Buffer в Uint8Array для NextResponse
      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `${dispositionType}; filename="${encodeURIComponent(fileRecord.originalName)}"`,
          'Cache-Control': 'private, no-store, max-age=0',
          Pragma: 'no-cache',
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

