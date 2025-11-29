import prisma from '@/lib/prisma'
import { parsePipelineStages } from '@/lib/pipelines'

export interface ProcessedEmailResult {
  contactId?: number
  dealId?: number
  userId?: number
  contactCreated: boolean
  dealCreated: boolean
}

export async function processIncomingEmail(
  email: {
    fromEmail: string
    from: string
    subject: string
    body: string
  },
  integration: {
    id: number
    companyId: number
    autoCreateContact: boolean
    autoCreateDeal: boolean
    defaultSourceId: number | null
    defaultPipelineId: number | null
    defaultAssigneeId: number | null
  },
  companyId: number
): Promise<ProcessedEmailResult> {
  const result: ProcessedEmailResult = {
    contactCreated: false,
    dealCreated: false,
  }

  // Находим или создаем контакт
  let contact = await prisma.contact.findFirst({
    where: {
      user: {
        companyId,
      },
      email: email.fromEmail,
    },
  })

  if (!contact && integration.autoCreateContact) {
    // Извлекаем имя из поля "from"
    const name = email.from || email.fromEmail.split('@')[0]

    contact = await prisma.contact.create({
      data: {
        name,
        email: email.fromEmail,
        userId: integration.defaultAssigneeId || null,
      },
    })
    result.contactCreated = true
    result.contactId = contact.id
  } else if (contact) {
    result.contactId = contact.id
  }

  // Создаем сделку, если включено
  if (integration.autoCreateDeal && contact && integration.defaultPipelineId) {
    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id: integration.defaultPipelineId,
        companyId,
      },
      select: { stages: true },
    })

    if (pipeline) {
      const stages = parsePipelineStages(pipeline.stages)
      const initialStage = stages[0]?.name || 'Новый лид'

      // Определяем userId: используем defaultAssigneeId, contact.userId или первого пользователя компании
      let userId: number | null = integration.defaultAssigneeId || contact.userId || null
      if (!userId) {
        const firstUser = await prisma.user.findFirst({
          where: { companyId },
          select: { id: true },
        })
        userId = firstUser?.id ?? null
      }

      // Если все еще нет userId, не создаем сделку
      if (!userId || typeof userId !== 'number') {
        console.warn('Cannot create deal: no userId available')
        return result
      }

      // После проверки TypeScript знает, что userId - это number
      const deal = await prisma.deal.create({
        data: {
          title: email.subject || `Заявка от ${email.from}`,
          amount: 0,
          currency: 'RUB',
          stage: initialStage,
          contactId: contact.id,
          userId: userId, // TypeScript теперь знает, что это number
          pipelineId: integration.defaultPipelineId,
          sourceId: integration.defaultSourceId,
        },
      })
      result.dealId = deal.id
      result.dealCreated = true
      result.userId = deal.userId
    }
  } else if (contact) {
    result.userId = contact.userId || undefined
  }

  return result
}

