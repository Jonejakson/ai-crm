import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'

// Получить шаблон по ID
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const templateId = parseInt(id)
    const companyId = parseInt(user.companyId)

    const template = await prisma.emailTemplate.findFirst({
      where: {
        id: templateId,
        companyId,
      },
    })

    if (!template) {
      return NextResponse.json(
        { error: 'Шаблон не найден' },
        { status: 404 }
      )
    }

    return NextResponse.json(template)
  } catch (error: any) {
    console.error('Error fetching email template:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// Обновить шаблон
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const templateId = parseInt(id)
    const companyId = parseInt(user.companyId)
    const body = await req.json()
    const { name, subject, body: templateBody, description } = body

    if (!name || !subject || !templateBody) {
      return NextResponse.json(
        { error: 'Название, тема и текст шаблона обязательны' },
        { status: 400 }
      )
    }

    // Проверяем, что шаблон существует и принадлежит компании
    const existing = await prisma.emailTemplate.findFirst({
      where: {
        id: templateId,
        companyId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Шаблон не найден' },
        { status: 404 }
      )
    }

    // Проверяем, что новое имя не конфликтует с другим шаблоном
    if (name !== existing.name) {
      const nameConflict = await prisma.emailTemplate.findUnique({
        where: {
          companyId_name: {
            companyId,
            name,
          },
        },
      })

      if (nameConflict) {
        return NextResponse.json(
          { error: 'Шаблон с таким названием уже существует' },
          { status: 400 }
        )
      }
    }

    const template = await prisma.emailTemplate.update({
      where: { id: templateId },
      data: {
        name,
        subject,
        body: templateBody,
        description: description || null,
      },
    })

    return NextResponse.json(template)
  } catch (error: any) {
    console.error('Error updating email template:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Шаблон с таким названием уже существует' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// Удалить шаблон
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const templateId = parseInt(id)
    const companyId = parseInt(user.companyId)

    // Проверяем, что шаблон существует и принадлежит компании
    const existing = await prisma.emailTemplate.findFirst({
      where: {
        id: templateId,
        companyId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Шаблон не найден' },
        { status: 404 }
      )
    }

    await prisma.emailTemplate.delete({
      where: { id: templateId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting email template:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

