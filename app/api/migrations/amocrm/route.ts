import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/get-session"
import { transformAmoCRMContact, transformAmoCRMDeal, transformAmoCRMPipeline } from "@/lib/migrations/amocrm"
import type { AmoCRMContact, AmoCRMDeal, AmoCRMPipeline } from "@/lib/migrations/amocrm"

// Импорт данных из AmoCRM
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const {
      subdomain,
      accessToken,
      contacts,
      deals,
      pipelines,
      fieldMapping,
      defaultUserId,
      defaultPipelineId,
      defaultSourceId,
      defaultDealTypeId,
    } = body

    if (!subdomain || !accessToken) {
      return NextResponse.json({ error: "subdomain и accessToken обязательны" }, { status: 400 })
    }

    if (!contacts || !Array.isArray(contacts)) {
      return NextResponse.json({ error: "contacts должен быть массивом" }, { status: 400 })
    }

    const companyId = parseInt(user.companyId)
    const userId = defaultUserId ? Number(defaultUserId) : parseInt(user.id)

    // Проверяем, что пользователь существует и принадлежит компании
    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
      },
    })

    if (!targetUser) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 })
    }

    const results = {
      contacts: { created: 0, skipped: 0, errors: [] as string[] },
      deals: { created: 0, skipped: 0, errors: [] as string[] },
      pipelines: { created: 0, skipped: 0, errors: [] as string[] },
    }

    // Импортируем воронки
    if (pipelines && Array.isArray(pipelines)) {
      for (const amoPipeline of pipelines as AmoCRMPipeline[]) {
        try {
          const stages = transformAmoCRMPipeline(amoPipeline)
          if (stages.length === 0) continue

          // Проверяем, существует ли уже воронка с таким именем
          const existing = await prisma.pipeline.findFirst({
            where: {
              companyId,
              name: amoPipeline.name,
            },
          })

          if (existing) {
            results.pipelines.skipped++
            continue
          }

          await prisma.pipeline.create({
            data: {
              name: amoPipeline.name,
              stages: JSON.stringify(stages),
              companyId,
              isDefault: false,
            },
          })

          results.pipelines.created++
        } catch (error: any) {
          results.pipelines.errors.push(`Воронка ${amoPipeline.name}: ${error.message}`)
        }
      }
    }

    // Импортируем контакты
    const contactMap = new Map<number, number>() // AmoCRM ID -> наш ID

    for (const amoContact of contacts as AmoCRMContact[]) {
      try {
        const contactData = transformAmoCRMContact(amoContact, userId, fieldMapping?.contact)

        // Проверяем дубликаты по email или телефону
        let existingContact = null
        if (contactData.email) {
          existingContact = await prisma.contact.findFirst({
            where: {
              email: contactData.email,
              user: { companyId },
            },
          })
        }

        if (!existingContact && contactData.phone) {
          existingContact = await prisma.contact.findFirst({
            where: {
              phone: contactData.phone,
              user: { companyId },
            },
          })
        }

        if (existingContact) {
          contactMap.set(amoContact.id, existingContact.id)
          results.contacts.skipped++
          continue
        }

        const contact = await prisma.contact.create({
          data: contactData,
        })

        contactMap.set(amoContact.id, contact.id)
        results.contacts.created++
      } catch (error: any) {
        results.contacts.errors.push(`Контакт ${amoContact.name || amoContact.id}: ${error.message}`)
      }
    }

    // Импортируем сделки
    if (deals && Array.isArray(deals)) {
      // Получаем воронки для маппинга этапов
      const pipelines = await prisma.pipeline.findMany({
        where: { companyId },
      })

      for (const amoDeal of deals as AmoCRMDeal[]) {
        try {
          // Находим контакт для сделки
          const contactId = amoDeal.contacts?.[0]?.id
          if (!contactId || !contactMap.has(contactId)) {
            results.deals.skipped++
            continue
          }

          const ourContactId = contactMap.get(contactId)!

          // Определяем этап
          let stage = 'Первичный контакт'
          if (amoDeal.status_id && amoDeal.pipeline_id) {
            const pipeline = pipelines.find(p => p.id === amoDeal.pipeline_id)
            if (pipeline) {
              const stages = JSON.parse(pipeline.stages) as Array<{ name: string }>
              // Пытаемся найти этап по ID (если есть маппинг)
              // Иначе используем первый этап
              stage = stages[0]?.name || 'Первичный контакт'
            }
          }

          const dealData = transformAmoCRMDeal(
            amoDeal,
            ourContactId,
            userId,
            stage,
            defaultPipelineId ? Number(defaultPipelineId) : null,
            defaultSourceId ? Number(defaultSourceId) : null,
            defaultDealTypeId ? Number(defaultDealTypeId) : null
          )

          await prisma.deal.create({
            data: dealData,
          })

          results.deals.created++
        } catch (error: any) {
          results.deals.errors.push(`Сделка ${amoDeal.name || amoDeal.id}: ${error.message}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Импорт завершен",
      results,
    })
  } catch (error) {
    console.error("[migrations][amocrm]", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

