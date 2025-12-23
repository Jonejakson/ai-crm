import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'
import { AutomationTriggerType, AutomationActionType } from '@prisma/client'
import { checkAutomationsAccess } from '@/lib/subscription-limits'

export async function GET() {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 })
  }

  try {
    const automations = await prisma.automation.findMany({
      where: {
        companyId: Number(currentUser.companyId),
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ automations })
  } catch (error) {
    console.error('[automations][GET]', error)
    return NextResponse.json({ error: 'Ошибка загрузки автоматизаций' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 })
  }

  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Только администратор может создавать автоматизации' }, { status: 403 })
  }

  const companyId = Number(currentUser.companyId)

  // Проверка, не истекла ли подписка
  const { canCreateEntities } = await import('@/lib/subscription-limits')
  const canCreate = await canCreateEntities(companyId)
  if (!canCreate.allowed) {
    return NextResponse.json(
      { 
        error: canCreate.message || 'Подписка закончилась',
        subscriptionExpired: true,
      },
      { status: 403 }
    )
  }

  // Проверка доступа к автоматизациям по тарифу
  const automationsAccess = await checkAutomationsAccess(companyId)
  if (!automationsAccess.allowed) {
    return NextResponse.json(
      { 
        error: automationsAccess.message || 'Автоматизации недоступны в вашем тарифе',
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { name, description, isActive, triggerType, triggerConfig, actions } = body

    if (!name || !triggerType || !actions || !Array.isArray(actions) || actions.length === 0) {
      return NextResponse.json({ error: 'Необходимы: name, triggerType, actions' }, { status: 400 })
    }

    const automation = await prisma.automation.create({
      data: {
        name,
        description: description || null,
        isActive: isActive !== false,
        triggerType: triggerType as AutomationTriggerType,
        triggerConfig: triggerConfig || null,
        actions: actions as any,
        companyId: Number(currentUser.companyId),
      },
    })

    return NextResponse.json({ automation })
  } catch (error) {
    console.error('[automations][POST]', error)
    return NextResponse.json({ error: 'Ошибка создания автоматизации' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 })
  }

  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Только администратор может редактировать автоматизации' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { id, name, description, isActive, triggerType, triggerConfig, actions } = body

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
    }

    const automation = await prisma.automation.update({
      where: {
        id: Number(id),
        companyId: Number(currentUser.companyId),
      },
      data: {
        name,
        description: description || null,
        isActive,
        triggerType: triggerType as AutomationTriggerType,
        triggerConfig: triggerConfig || null,
        actions: actions as any,
      },
    })

    return NextResponse.json({ automation })
  } catch (error) {
    console.error('[automations][PUT]', error)
    return NextResponse.json({ error: 'Ошибка обновления автоматизации' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 })
  }

  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Только администратор может удалять автоматизации' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
    }

    await prisma.automation.delete({
      where: {
        id: Number(id),
        companyId: Number(currentUser.companyId),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[automations][DELETE]', error)
    return NextResponse.json({ error: 'Ошибка удаления автоматизации' }, { status: 500 })
  }
}

