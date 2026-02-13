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

          if (triggerType === 'DEAL_STAGE_CHANGED') {
            if (config.stage && context.newStage !== config.stage) {
              continue
            }
            if (config.fromStage && context.oldStage !== config.fromStage) {
              continue
            }
            if (config.toStage && context.newStage !== config.toStage) {
              continue
            }
          }

          if (triggerType === 'DEAL_AMOUNT_CHANGED') {
            const amount =
              typeof context.newAmount === 'number'
                ? context.newAmount
                : typeof context.oldAmount === 'number'
                ? context.oldAmount
                : undefined

            if (typeof config.minAmount === 'number' && (amount === undefined || amount < config.minAmount)) {
              continue
            }

            if (typeof config.maxAmount === 'number' && (amount === undefined || amount > config.maxAmount)) {
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
          const dueDate =
            params.dueDate
              ? new Date(params.dueDate)
              : typeof params.dueInDays === 'number'
              ? addDays(new Date(), Number(params.dueInDays))
              : null

          await prisma.task.create({
            data: {
              title: params.title,
              description: params.description || null,
              status: 'pending',
              dueDate,
              contactId: context.contactId,
              userId: params.assignedUserId ? Number(params.assignedUserId) : context.userId || null,
            },
          })
        }
        break

      case 'SEND_EMAIL':
        if (context.contactId && params.subject && (params.body || params.text || params.html)) {
          const { isEmailConfigured } = await import('./email')
          if (!isEmailConfigured()) {
            console.warn('[automations] SEND_EMAIL skipped: SMTP не настроен')
            break
          }
          const contact = await prisma.contact.findUnique({
            where: { id: context.contactId },
          })

          if (contact?.email) {
            try {
              const { sendEmail } = await import('./email')
              await sendEmail({
                to: contact.email,
                subject: params.subject,
                text: params.text || params.body,
                html: params.html,
              })
              await prisma.emailMessage.create({
                data: {
                  toEmail: contact.email,
                  subject: params.subject,
                  body: params.html || params.text || params.body || '',
                  status: 'sent',
                  contactId: context.contactId,
                  userId: context.userId || undefined,
                },
              })
            } catch (err) {
              console.error('[automations] SEND_EMAIL failed:', err)
            }
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
        if (params.title && params.message) {
          const targetUserId = params.userId ? Number(params.userId) : context.userId
          if (!targetUserId) break
          await prisma.notification.create({
            data: {
              title: params.title,
              message: params.message,
              type: params.type || 'info',
              entityType: params.entityType || null,
              entityId: params.entityId || null,
              userId: targetUserId,
            },
          })
        }
        break

      case 'UPDATE_DEAL_STAGE': {
        const stage = params?.newStage ?? params?.stage
        if (context.dealId && stage) {
          await prisma.deal.update({
            where: { id: context.dealId },
            data: { stage: String(stage) },
          })
        }
        break
      }

      default:
        console.warn('[automations] Unknown action type:', type)
    }
  } catch (error) {
    console.error('[automations][executeAction]', error)
  }
}

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

