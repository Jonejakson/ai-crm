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
    id: 'deal-created-quick-touch',
    title: 'Быстрый фоллоу-ап после создания сделки',
    description: 'Сразу после создания сделки — создать задачу на контакт и отправить приветственное письмо.',
    triggerType: 'DEAL_CREATED',
    actions: [
      {
        type: 'CREATE_TASK',
        params: {
          title: 'Связаться с клиентом',
          description: 'Поздороваться, уточнить потребность и договориться о следующем шаге.',
          dueInDays: 0,
        },
      },
      {
        type: 'SEND_EMAIL',
        params: {
          subject: 'Добро пожаловать!',
          body: 'Спасибо, что выбрали нас. Давайте обсудим детали и согласуем следующий шаг.',
        },
      },
    ],
    category: 'Сделки',
    complexity: 'basic',
  },
  {
    id: 'stage-negotiation-raise-probability',
    title: 'Повысить вероятность на этапе переговоров',
    description: 'При переходе на этап negotiation повышаем вероятность сделки.',
    triggerType: 'DEAL_STAGE_CHANGED',
    triggerConfig: { stage: 'negotiation' },
    actions: [
      {
        type: 'CHANGE_PROBABILITY',
        params: {
          probability: 60,
        },
      },
    ],
    category: 'Сделки',
    complexity: 'basic',
  },
  {
    id: 'stage-proposal-send-email',
    title: 'Отправить КП на этапе предложения',
    description: 'При переходе на этап proposal отправить письмо с КП.',
    triggerType: 'DEAL_STAGE_CHANGED',
    triggerConfig: { stage: 'proposal' },
    actions: [
      {
        type: 'SEND_EMAIL',
        params: {
          subject: 'Коммерческое предложение',
          body: 'Добрый день! Отправляем вам наше предложение. Будем рады обсудить детали.',
        },
      },
      {
        type: 'CREATE_TASK',
        params: {
          title: 'Дожать предложение',
          description: 'Уточнить вопросы, договориться о созвоне.',
          dueInDays: 1,
        },
      },
    ],
    category: 'Сделки',
    complexity: 'basic',
  },
  {
    id: 'deal-amount-range-assign-and-probability',
    title: 'Маршрутка для средних сделок',
    description: 'Если сумма сделки от 50 000 до 150 000 ₽ — назначить менеджера и выставить вероятность.',
    triggerType: 'DEAL_AMOUNT_CHANGED',
    triggerConfig: { minAmount: 50000, maxAmount: 150000 },
    actions: [
      {
        type: 'ASSIGN_USER',
        params: {
          userId: null, // выберите менеджера перед сохранением
        },
      },
      {
        type: 'CHANGE_PROBABILITY',
        params: {
          probability: 45,
        },
      },
      {
        type: 'CREATE_NOTIFICATION',
        params: {
          title: 'Средняя сделка',
          message: 'Сделка в диапазоне 50-150к, проверьте план действий.',
          type: 'info',
        },
      },
    ],
    category: 'Сделки',
    complexity: 'advanced',
  },
]


