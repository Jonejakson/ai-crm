import prisma from './prisma'
import { AutomationTriggerType, AutomationActionType } from '@prisma/client'

interface AutomationContext {
  dealId?: number
  contactId?: number
  taskId?: number
  eventId?: number
  userId?: number
  companyId: number
  oldStage?: string
  newStage?: string
  oldAmount?: number
  newAmount?: number
}

export async function processAutomations(
  triggerType: AutomationTriggerType,
  context: AutomationContext
) {
  try {
    const automations = await prisma.automation.findMany({
      where: {
        companyId: context.companyId,
        isActive: true,
        triggerType,
      },
    })

    for (const automation of automations) {
      // Проверяем условия триггера
      if (automation.triggerConfig) {
        const config = automation.triggerConfig as any

        // Проверка этапа (для DEAL_STAGE_CHANGED)
        if (triggerType === 'DEAL_STAGE_CHANGED' && config.stage) {
          if (context.newStage !== config.stage) {
            continue // пропускаем, если этап не совпадает
          }
        }

        // Проверка суммы (для DEAL_AMOUNT_CHANGED)
        if (triggerType === 'DEAL_AMOUNT_CHANGED' && config.minAmount) {
          if (!context.newAmount || context.newAmount < config.minAmount) {
            continue
          }
        }
      }

      // Выполняем действия
      const actions = automation.actions as any[]
      for (const action of actions) {
        await executeAction(action, context)
      }
    }
  } catch (error) {
    console.error('[automations][process]', error)
  }
}

async function executeAction(action: any, context: AutomationContext) {
  const { type, params } = action

  try {
    switch (type) {
      case 'CREATE_TASK':
        if (context.contactId && params.title) {
          await prisma.task.create({
            data: {
              title: params.title,
              description: params.description || null,
              status: 'pending',
              dueDate: params.dueDate ? new Date(params.dueDate) : null,
              contactId: context.contactId,
              userId: context.userId || null,
            },
          })
        }
        break

      case 'SEND_EMAIL':
        if (context.contactId && params.subject && params.body) {
          const contact = await prisma.contact.findUnique({
            where: { id: context.contactId },
          })

          if (contact?.email) {
            // Импортируем функцию отправки email
            const { sendEmail } = await import('./email')
            await sendEmail({
              to: contact.email,
              subject: params.subject,
              body: params.body,
              contactId: context.contactId,
              userId: context.userId || undefined,
            })
          }
        }
        break

      case 'CHANGE_PROBABILITY':
        if (context.dealId && params.probability !== undefined) {
          await prisma.deal.update({
            where: { id: context.dealId },
            data: { probability: Number(params.probability) },
          })
        }
        break

      case 'ASSIGN_USER':
        if (context.dealId && params.userId) {
          await prisma.deal.update({
            where: { id: context.dealId },
            data: { userId: Number(params.userId) },
          })
        }
        break

      case 'CREATE_NOTIFICATION':
        if (params.userId && params.title && params.message) {
          await prisma.notification.create({
            data: {
              title: params.title,
              message: params.message,
              type: params.type || 'info',
              entityType: params.entityType || null,
              entityId: params.entityId || null,
              userId: Number(params.userId),
            },
          })
        }
        break

      case 'UPDATE_DEAL_STAGE':
        if (context.dealId && params.stage) {
          await prisma.deal.update({
            where: { id: context.dealId },
            data: { stage: params.stage },
          })
        }
        break

      default:
        console.warn('[automations] Unknown action type:', type)
    }
  } catch (error) {
    console.error('[automations][executeAction]', error)
  }
}

