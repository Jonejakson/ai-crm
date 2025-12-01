import { NextResponse } from 'next/server'
import { getCurrentUser, getUserId } from '@/lib/get-session'
import prisma from '@/lib/prisma'
import { validateRequest, createCommentSchema } from '@/lib/validation'

// GET /api/comments?entityType=deal&entityId=1
export async function GET(req: Request) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'entityType and entityId are required' },
        { status: 400 }
      )
    }

    // Проверяем доступ к сущности
    if (entityType === 'deal') {
      const deal = await prisma.deal.findUnique({
        where: { id: entityId },
        include: {
          user: {
            select: { companyId: true },
          },
        },
      })

      if (!deal || deal.user.companyId !== Number(currentUser.companyId)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
    } else if (entityType === 'task') {
      const task = await prisma.task.findUnique({
        where: { id: entityId },
        include: {
          user: {
            select: { companyId: true },
          },
        },
      })

      if (!task || (task.user && task.user.companyId !== Number(currentUser.companyId))) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid entityType' },
        { status: 400 }
      )
    }

    const comments = await prisma.comment.findMany({
      where: {
        entityType,
        entityId: entityId,
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
        createdAt: 'asc',
      },
    })

    return NextResponse.json({ comments })
  } catch (error: any) {
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    )
  }
}

// POST /api/comments
export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rawBody = await req.json()
    
    // Валидация с помощью Zod
    const validationResult = validateRequest(createCommentSchema, rawBody)
    
    if (validationResult instanceof NextResponse) {
      return validationResult
    }
    
    const { text, entityType, entityId } = validationResult

    // Проверяем доступ к сущности
    if (entityType === 'deal') {
      const deal = await prisma.deal.findUnique({
        where: { id: entityId },
        include: {
          user: {
            select: { companyId: true },
          },
        },
      })

      if (!deal || deal.user.companyId !== Number(currentUser.companyId)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
    } else if (entityType === 'task') {
      const task = await prisma.task.findUnique({
        where: { id: entityId },
        include: {
          user: {
            select: { companyId: true },
          },
        },
      })

      if (!task || (task.user && task.user.companyId !== Number(currentUser.companyId))) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid entityType' },
        { status: 400 }
      )
    }

    const userId = getUserId(currentUser)
    if (!userId) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 401 })
    }

    const comment = await prisma.comment.create({
      data: {
        text,
        entityType,
        entityId: entityId,
        userId: userId,
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
    })

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating comment:', error)
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    )
  }
}

