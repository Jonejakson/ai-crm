import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/get-session"
import { transformBitrix24Contact, transformBitrix24Deal, transformBitrix24Stages } from "@/lib/migrations/bitrix24"
import type { Bitrix24Contact, Bitrix24Deal, Bitrix24Stage } from "@/lib/migrations/bitrix24"

// Импорт данных из Bitrix24
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
      domain,
      accessToken,
      contacts,
      deals,
      stages,
      fieldMapping,
      defaultUserId,
      defaultPipelineId,
      defaultSourceId,
      defaultDealTypeId,
    } = body

    if (!domain || !accessToken) {
      return NextResponse.json({ error: "domain и accessToken обязательны" }, { status: 400 })
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
    }

    // Импортируем контакты
    const contactMap = new Map<string, number>() // Bitrix24 ID -> наш ID

    for (const bitrixContact of contacts as Bitrix24Contact[]) {
      try {
        const contactData = transformBitrix24Contact(bitrixContact, userId, fieldMapping?.contact)

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
          contactMap.set(bitrixContact.ID, existingContact.id)
          results.contacts.skipped++
          continue
        }

        const contact = await prisma.contact.create({
          data: contactData,
        })

        contactMap.set(bitrixContact.ID, contact.id)
        results.contacts.created++
      } catch (error: any) {
        const contactName = bitrixContact.NAME || bitrixContact.LAST_NAME || bitrixContact.ID
        results.contacts.errors.push(`Контакт ${contactName}: ${error.message}`)
      }
    }

    // Импортируем сделки
    if (deals && Array.isArray(deals)) {
      // Получаем воронки для маппинга этапов
      const pipelines = await prisma.pipeline.findMany({
        where: { companyId },
      })

      // Преобразуем этапы Bitrix24
      let stageMapping: Record<string, string> = {}
      if (stages && Array.isArray(stages)) {
        const transformedStages = transformBitrix24Stages(stages as Bitrix24Stage[])
        // Создаем маппинг: Bitrix24 STATUS_ID -> название этапа
        stages.forEach((stage: Bitrix24Stage, index: number) => {
          stageMapping[stage.STATUS_ID] = transformedStages[index]?.name || stage.NAME
        })
      }

      for (const bitrixDeal of deals as Bitrix24Deal[]) {
        try {
          // Находим контакт для сделки
          const contactId = bitrixDeal.CONTACT_ID
          if (!contactId || !contactMap.has(contactId)) {
            results.deals.skipped++
            continue
          }

          const ourContactId = contactMap.get(contactId)!

          // Определяем этап
          let stage = 'Первичный контакт'
          if (bitrixDeal.STAGE_ID && stageMapping[bitrixDeal.STAGE_ID]) {
            stage = stageMapping[bitrixDeal.STAGE_ID]
          }

          const dealData = transformBitrix24Deal(
            bitrixDeal,
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
          results.deals.errors.push(`Сделка ${bitrixDeal.TITLE || bitrixDeal.ID}: ${error.message}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Импорт завершен",
      results,
    })
  } catch (error) {
    console.error("[migrations][bitrix24]", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

