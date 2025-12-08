export type AutomationTemplate = {
  id: string
  title: string
  description: string
  triggerType:
    | 'DEAL_STAGE_CHANGED'
    | 'DEAL_CREATED'
    | 'DEAL_AMOUNT_CHANGED'
    | 'TASK_CREATED'
    | 'TASK_COMPLETED'
    | 'CONTACT_CREATED'
    | 'EVENT_CREATED'
  triggerConfig?: Record<string, any>
  actions: Array<{
    type:
      | 'CREATE_TASK'
      | 'SEND_EMAIL'
      | 'CHANGE_PROBABILITY'
      | 'ASSIGN_USER'
      | 'CREATE_NOTIFICATION'
      | 'UPDATE_DEAL_STAGE'
      | string
    params?: Record<string, any>
  }>
  category?: string
  complexity?: 'basic' | 'advanced'
}

export const automationTemplates: AutomationTemplate[] = [
  {
    id: 'deal-to-negotiation-task-email',
    title: 'Звонок и письмо при переходе в переговоры',
    description: 'Когда сделка переходит на этап negotiation — создать задачу и отправить письмо.',
    triggerType: 'DEAL_STAGE_CHANGED',
    triggerConfig: { stage: 'negotiation' },
    actions: [
      {
        type: 'CREATE_TASK',
        params: {
          title: 'Связаться с клиентом',
          description: 'Уточнить детали и отправить КП',
          dueInDays: 1,
        },
      },
      {
        type: 'SEND_EMAIL',
        params: {
          subject: 'Спасибо за встречу',
          body: 'Добрый день! Отправляю материалы по нашей встрече. Готов обсудить детали.',
        },
      },
    ],
    category: 'Сделки',
    complexity: 'basic',
  },
  {
    id: 'high-amount-assign-manager',
    title: 'Назначить менеджера на крупную сделку',
    description: 'Если сумма сделки выше 300 000 ₽ — назначить старшего менеджера.',
    triggerType: 'DEAL_AMOUNT_CHANGED',
    triggerConfig: { minAmount: 300000 },
    actions: [
      {
        type: 'ASSIGN_USER',
        params: {
          userId: null, // выберите менеджера перед сохранением
        },
      },
      {
        type: 'CREATE_NOTIFICATION',
        params: {
          title: 'Новая крупная сделка',
          message: 'Сделка превышает 300 000 ₽. Проверьте детали.',
          type: 'info',
        },
      },
    ],
    category: 'Сделки',
    complexity: 'basic',
  },
  {
    id: 'contact-created-followup',
    title: 'Фоллоу-ап после создания контакта',
    description: 'Создать задачу и письмо после создания контакта.',
    triggerType: 'CONTACT_CREATED',
    actions: [
      {
        type: 'CREATE_TASK',
        params: {
          title: 'Первичный контакт',
          description: 'Позвонить или написать клиенту',
          dueInDays: 0,
        },
      },
      {
        type: 'SEND_EMAIL',
        params: {
          subject: 'Рады знакомству!',
          body: 'Добрый день! Давайте обсудим ваши задачи и как мы можем помочь.',
        },
      },
    ],
    category: 'Контакты',
    complexity: 'basic',
  },
  {
    id: 'task-completed-update-stage',
    title: 'Перевод сделки после завершения задачи',
    description: 'Когда задача завершена — перевести сделку на следующий этап.',
    triggerType: 'TASK_COMPLETED',
    actions: [
      {
        type: 'UPDATE_DEAL_STAGE',
        params: {
          newStage: 'proposal',
        },
      },
    ],
    category: 'Задачи',
    complexity: 'basic',
  },
]


