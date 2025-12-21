import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/get-session'

// API для получения списка пользователей с их компаниями и статистикой

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Разрешаем доступ для admin и owner
  if (user.role !== 'admin' && user.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const isOwner = user.role === 'owner'
    const companyId = isOwner ? undefined : Number(user.companyId)

    // Получаем пользователей с их компаниями
    const users = await prisma.user.findMany({
      where: isOwner ? {} : { companyId: companyId! },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            deals: true,
            contacts: true,
            tasks: true,
          },
        },
        contacts: {
          select: {
            inn: true,
            company: true,
          },
          take: 100, // Берем первые 100 контактов для анализа
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Для каждой компании получаем количество пользователей
    const companyUserCounts = await prisma.user.groupBy({
      by: ['companyId'],
      where: isOwner ? {} : { companyId: companyId! },
      _count: {
        id: true,
      },
    })

    const companyCountsMap = new Map(
      companyUserCounts.map((c) => [c.companyId, c._count.id])
    )

    // Формируем ответ с дополнительной информацией
    const usersWithStats = users.map((u) => {
      // Разбиваем имя на имя и фамилию (если есть пробел)
      const nameParts = u.name.trim().split(/\s+/)
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      // Определяем тип лица на основе контактов
      // Если у пользователя есть контакты с ИНН или названием компании - это юр. лицо
      const hasJurContacts = u.contacts.some(
        (c) => (c.inn && c.inn.trim() !== '') || (c.company && c.company.trim() !== '')
      )
      const hasIndContacts = u.contacts.some(
        (c) => !c.inn && (!c.company || c.company.trim() === '')
      )
      
      // Определяем преобладающий тип
      let contactType: 'individual' | 'legal' | 'mixed' | 'unknown' = 'unknown'
      if (u.contacts.length > 0) {
        if (hasJurContacts && !hasIndContacts) {
          contactType = 'legal'
        } else if (!hasJurContacts && hasIndContacts) {
          contactType = 'individual'
        } else if (hasJurContacts && hasIndContacts) {
          contactType = 'mixed'
        }
      }

      return {
        id: u.id,
        email: u.email,
        firstName,
        lastName,
        fullName: u.name,
        phone: u.phone,
        role: u.role,
        contactType, // Тип контактов: individual, legal, mixed, unknown
        company: {
          id: u.company.id,
          name: u.company.name,
          usersCount: companyCountsMap.get(u.company.id) || 0,
        },
        stats: {
          dealsCount: u._count.deals,
          contactsCount: u._count.contacts,
          tasksCount: u._count.tasks,
        },
        createdAt: u.createdAt,
      }
    })

    return NextResponse.json({
      ok: true,
      users: usersWithStats,
      total: usersWithStats.length,
    })
  } catch (error) {
    console.error('[ops][users]', error)
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }
}

