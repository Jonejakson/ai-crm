// Утилиты для работы с шаблонами писем

export interface TemplateContext {
  contact?: {
    name?: string | null
    email?: string | null
    phone?: string | null
    company?: string | null
    position?: string | null
  } | null
  deal?: {
    title?: string | null
    amount?: number | null
    currency?: string | null
    stage?: string | null
    probability?: number | null
  } | null
  manager?: {
    name?: string | null
    email?: string | null
  } | null
  company?: {
    name?: string | null
  } | null
}

/**
 * Заменяет переменные в тексте шаблона на реальные значения
 */
export function replaceTemplateVariables(
  text: string,
  context: TemplateContext
): string {
  if (!text) return text

  let result = text

  // Переменные контакта
  if (context.contact) {
    result = result.replace(/\{\{name\}\}/g, context.contact.name || '')
    result = result.replace(/\{\{email\}\}/g, context.contact.email || '')
    result = result.replace(/\{\{phone\}\}/g, context.contact.phone || '')
    result = result.replace(/\{\{company\}\}/g, context.contact.company || '')
    result = result.replace(/\{\{position\}\}/g, context.contact.position || '')
  }

  // Переменные сделки
  if (context.deal) {
    result = result.replace(/\{\{deal_title\}\}/g, context.deal.title || '')
    result = result.replace(
      /\{\{deal_amount\}\}/g,
      context.deal.amount
        ? `${context.deal.amount} ${context.deal.currency || 'RUB'}`
        : ''
    )
    result = result.replace(/\{\{deal_stage\}\}/g, context.deal.stage || '')
    result = result.replace(
      /\{\{deal_probability\}\}/g,
      context.deal.probability !== undefined
        ? `${context.deal.probability}%`
        : ''
    )
  }

  // Переменные менеджера
  if (context.manager) {
    result = result.replace(/\{\{manager_name\}\}/g, context.manager.name || '')
    result = result.replace(
      /\{\{manager_email\}\}/g,
      context.manager.email || ''
    )
  }

  // Системные переменные
  result = result.replace(
    /\{\{current_date\}\}/g,
    new Date().toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  )
  result = result.replace(
    /\{\{current_time\}\}/g,
    new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    })
  )
  result = result.replace(
    /\{\{current_datetime\}\}/g,
    new Date().toLocaleString('ru-RU')
  )

  // Переменные компании
  if (context.company) {
    result = result.replace(
      /\{\{company_name\}\}/g,
      context.company.name || ''
    )
  }

  return result
}

/**
 * Получает список всех доступных переменных
 */
export function getAvailableVariables(context: TemplateContext): string[] {
  const variables: string[] = []

  // Базовые переменные контакта
  variables.push('{{name}}', '{{email}}', '{{phone}}', '{{company}}', '{{position}}')

  // Переменные сделки
  if (context.deal) {
    variables.push(
      '{{deal_title}}',
      '{{deal_amount}}',
      '{{deal_stage}}',
      '{{deal_probability}}'
    )
  }

  // Переменные менеджера
  if (context.manager) {
    variables.push('{{manager_name}}', '{{manager_email}}')
  }

  // Системные переменные
  variables.push('{{current_date}}', '{{current_time}}', '{{current_datetime}}')

  // Переменные компании
  if (context.company) {
    variables.push('{{company_name}}')
  }

  return variables
}

/**
 * Валидирует шаблон и возвращает список неиспользуемых переменных
 */
export function validateTemplate(
  text: string,
  availableVariables: string[]
): {
  isValid: boolean
  unusedVariables: string[]
  unknownVariables: string[]
} {
  const variablePattern = /\{\{(\w+)\}\}/g
  const usedVariables: string[] = []
  let match

  while ((match = variablePattern.exec(text)) !== null) {
    const variable = `{{${match[1]}}}`
    if (!usedVariables.includes(variable)) {
      usedVariables.push(variable)
    }
  }

  const unknownVariables = usedVariables.filter(
    (v) => !availableVariables.includes(v)
  )

  return {
    isValid: unknownVariables.length === 0,
    unusedVariables: availableVariables.filter(
      (v) => !usedVariables.includes(v)
    ),
    unknownVariables,
  }
}

/**
 * Подсвечивает переменные в тексте для отображения
 */
export function highlightVariables(text: string): string {
  return text.replace(
    /\{\{(\w+)\}\}/g,
    '<span class="bg-yellow-200 dark:bg-yellow-900 px-1 rounded">$&</span>'
  )
}

