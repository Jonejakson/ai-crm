import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getCurrentUser } from '@/lib/get-session'
import prisma from '@/lib/prisma'

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
      include: {
        message: {
          include: {
            ticket: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    })

    if (!fileRecord) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Проверка доступа: owner видит все, пользователь - только файлы из своих тикетов
    if (fileRecord.message) {
      const ticket = fileRecord.message.ticket
      if (user.role !== 'owner' && ticket.userId !== Number(user.id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // Для файлов, не связанных с тикетами, проверяем доступ через entityType
      if (fileRecord.entityType === 'support_ticket_message') {
        // Дополнительная проверка через сообщение
        const message = await prisma.supportTicketMessage.findUnique({
          where: { id: fileRecord.entityId },
          include: {
            ticket: {
              include: {
                user: true,
              },
            },
          },
        })
        if (message && user.role !== 'owner' && message.ticket.userId !== Number(user.id)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
    }

    // Читаем файл
    const filePath = join(UPLOAD_DIR, filename)
    try {
      const fileBuffer = await readFile(filePath)

      // Определяем Content-Type
      const contentType = fileRecord.mimeType || 'application/octet-stream'

      // Возвращаем файл с правильными заголовками
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${encodeURIComponent(fileRecord.originalName)}"`,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    } catch (fileError) {
      console.error('[files][GET] File read error:', fileError)
      return NextResponse.json({ error: 'File not found on disk' }, { status: 404 })
    }
  } catch (error: any) {
    console.error('[files][GET]', error)
    return NextResponse.json({ error: 'Failed to get file' }, { status: 500 })
  }
}

