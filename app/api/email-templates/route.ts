import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'

// Получить все шаблоны компании
export async function GET() {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyId = parseInt(user.companyId)

    const templates = await prisma.emailTemplate.findMany({
      where: {
        companyId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(templates)
  } catch (error: any) {
    console.error('Error fetching email templates:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// Создать новый шаблон
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, subject, body: templateBody, description } = body

    if (!name || !subject || !templateBody) {
      return NextResponse.json(
        { error: 'Название, тема и текст шаблона обязательны' },
        { status: 400 }
      )
    }

    const companyId = parseInt(user.companyId)

    // Проверяем, что шаблон с таким именем не существует
    const existing = await prisma.emailTemplate.findUnique({
      where: {
        companyId_name: {
          companyId,
          name,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Шаблон с таким названием уже существует' },
        { status: 400 }
      )
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name,
        subject,
        body: templateBody,
        description: description || null,
        companyId,
      },
    })

    return NextResponse.json(template)
  } catch (error: any) {
    console.error('Error creating email template:', error)
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

