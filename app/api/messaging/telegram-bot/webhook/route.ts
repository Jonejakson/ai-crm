import { NextResponse, NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { decrypt } from "@/lib/encryption"
import { parsePipelineStages } from "@/lib/pipelines"
import { processAutomations } from "@/lib/automations"

// Webhook для получения сообщений от Telegram
export async function POST(request: NextRequest) {
  try {
    const update = await request.json()

    // Telegram отправляет обновления в формате { message: {...}, update_id: ... }
    if (!update.message) {
      return NextResponse.json({ ok: true })
    }

    const message = update.message
    const chatId = message.chat.id
    const text = message.text || message.caption || ""
    const from = message.from

    if (!from) {
      return NextResponse.json({ ok: true })
    }

    // Находим активную Telegram интеграцию
    const integration = await prisma.messagingIntegration.findFirst({
      where: {
        platform: 'TELEGRAM',
        isActive: true,
        botToken: { not: null },
      },
      include: {
        defaultAssignee: true,
        defaultSource: true,
        defaultPipeline: true,
      },
    })

    if (!integration || !integration.botToken) {
      console.warn("[telegram-webhook] No active integration found")
      return NextResponse.json({ ok: true })
    }

    // Извлекаем данные пользователя
    const phone = from.phone_number || null
    const firstName = from.first_name || ""
    const lastName = from.last_name || ""
    const name = `${firstName} ${lastName}`.trim() || `User ${from.id}`
    const username = from.username || null

    // Находим или создаем контакт
    let contact = null
    let isNewContact = false

    if (phone || username) {
      const whereConditions: any[] = []
      if (phone) {
        whereConditions.push({ phone })
      }
      if (username) {
        // Можно добавить поле username в Contact, если нужно
        // Пока ищем только по телефону
      }

      const existing = await prisma.contact.findFirst({
        where: {
          OR: whereConditions.length > 0 ? whereConditions : [{ phone: null }],
          user: {
            companyId: integration.companyId,
          },
        },
      })

      if (existing) {
        // Обновляем существующий контакт
        contact = await prisma.contact.update({
          where: { id: existing.id },
          data: {
            name: name || existing.name,
            phone: phone || existing.phone,
            userId: existing.userId || integration.defaultAssigneeId || null,
          },
        })
      } else if (integration.autoCreateContact) {
        // Создаем новый контакт
        let assignedUserId = integration.defaultAssigneeId
        if (!assignedUserId) {
          const fallbackUser = await prisma.user.findFirst({
            where: { companyId: integration.companyId },
            select: { id: true },
            orderBy: { createdAt: "asc" },
          })
          assignedUserId = fallbackUser?.id || null
        }

        if (!assignedUserId) {
          console.error("[telegram-webhook] No user available in company")
          return NextResponse.json({ ok: true })
        }

        contact = await prisma.contact.create({
          data: {
            name,
            phone,
            userId: assignedUserId,
          },
        })
        isNewContact = true
      }
    }

    // Сохраняем сообщение в диалог
    if (contact) {
      await prisma.dialog.create({
        data: {
          message: text,
          sender: "client",
          contactId: contact.id,
          platform: 'TELEGRAM',
          externalId: String(message.message_id),
        },
      })

      // Создаем сделку, если нужно
      if (integration.autoCreateDeal && integration.defaultPipelineId && isNewContact) {
        const pipeline = await prisma.pipeline.findFirst({
          where: {
            id: integration.defaultPipelineId,
            companyId: integration.companyId,
          },
          select: { stages: true },
        })

        if (pipeline) {
          const stages = parsePipelineStages(pipeline.stages)
          const initialStage = stages[0]?.name || "Новый лид"

          let userId: number | null = contact.userId || integration.defaultAssigneeId || null
          if (!userId) {
            const fallbackUser = await prisma.user.findFirst({
              where: { companyId: integration.companyId },
              select: { id: true },
              orderBy: { createdAt: "asc" },
            })
            userId = fallbackUser?.id || null
          }

          if (userId && typeof userId === 'number') {
            const deal = await prisma.deal.create({
              data: {
                title: `Заявка из Telegram: ${name}`,
                amount: 0,
                currency: "RUB",
                stage: initialStage,
                contactId: contact.id,
                userId: userId,
                pipelineId: integration.defaultPipelineId,
                sourceId: integration.defaultSourceId,
              },
            })

            // Запускаем автоматизации
            await processAutomations("DEAL_CREATED", {
              dealId: deal.id,
              contactId: contact.id,
              userId: userId,
              companyId: integration.companyId,
            })
          }
        }
      }

      // Запускаем автоматизации для нового контакта
      if (isNewContact) {
        await processAutomations("CONTACT_CREATED", {
          contactId: contact.id,
          userId: contact.userId || undefined,
          companyId: integration.companyId,
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[telegram-webhook][POST]", error)
    // Всегда возвращаем ok: true, чтобы Telegram не повторял запрос
    return NextResponse.json({ ok: true })
  }
}

// GET для верификации webhook (Telegram может проверять endpoint)
export async function GET() {
  return NextResponse.json({ status: "ok" })
}

