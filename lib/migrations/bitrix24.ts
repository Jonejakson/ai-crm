// Утилиты для преобразования данных из Bitrix24 в формат нашей CRM

export interface Bitrix24Contact {
  ID: string
  NAME?: string
  LAST_NAME?: string
  SECOND_NAME?: string
  COMPANY_ID?: string
  COMPANY_TITLE?: string
  POST?: string
  EMAIL?: Array<{ VALUE: string; VALUE_TYPE: string }>
  PHONE?: Array<{ VALUE: string; VALUE_TYPE: string }>
  ASSIGNED_BY_ID?: string
  CREATED_BY_ID?: string
  DATE_CREATE?: string
  DATE_MODIFY?: string
  UF_CRM_?: Record<string, any> // Кастомные поля
}

export interface Bitrix24Deal {
  ID: string
  TITLE: string
  OPPORTUNITY?: string
  CURRENCY_ID?: string
  STAGE_ID?: string
  ASSIGNED_BY_ID?: string
  CREATED_BY_ID?: string
  DATE_CREATE?: string
  DATE_MODIFY?: string
  CONTACT_ID?: string
  COMPANY_ID?: string
  UF_CRM_?: Record<string, any> // Кастомные поля
}

export interface Bitrix24Stage {
  STATUS_ID: string
  NAME: string
  COLOR?: string
}

/**
 * Преобразует контакт из Bitrix24 в формат нашей CRM
 */
export function transformBitrix24Contact(
  bitrixContact: Bitrix24Contact,
  userId: number,
  fieldMapping?: Record<string, string>
): {
  name: string
  email?: string
  phone?: string
  company?: string
  position?: string
  inn?: string
  userId: number
} {
  // Формируем имя
  const nameParts = [
    bitrixContact.NAME,
    bitrixContact.SECOND_NAME,
    bitrixContact.LAST_NAME,
  ].filter(Boolean)
  
  let name = nameParts.length > 0 
    ? nameParts.join(' ') 
    : bitrixContact.NAME || bitrixContact.LAST_NAME || 'Без имени'

  // Извлекаем email
  let email: string | undefined
  if (bitrixContact.EMAIL && bitrixContact.EMAIL.length > 0) {
    email = bitrixContact.EMAIL[0].VALUE
  }

  // Извлекаем телефон
  let phone: string | undefined
  if (bitrixContact.PHONE && bitrixContact.PHONE.length > 0) {
    phone = bitrixContact.PHONE[0].VALUE
  }

  // Компания
  let company = bitrixContact.COMPANY_TITLE

  // Должность
  let position = bitrixContact.POST

  // ИНН из кастомных полей
  let inn: string | undefined
  if (bitrixContact.UF_CRM_) {
    for (const [key, value] of Object.entries(bitrixContact.UF_CRM_)) {
      if (key.toLowerCase().includes('inn') || key.toLowerCase().includes('инн')) {
        inn = String(value)
        break
      }
    }
  }

  // Применяем маппинг полей, если указан
  if (fieldMapping) {
    if (fieldMapping.email && !email && bitrixContact.UF_CRM_) {
      email = extractCustomField(bitrixContact.UF_CRM_, fieldMapping.email)
    }
    if (fieldMapping.phone && !phone && bitrixContact.UF_CRM_) {
      phone = extractCustomField(bitrixContact.UF_CRM_, fieldMapping.phone)
    }
    if (fieldMapping.company && !company && bitrixContact.UF_CRM_) {
      company = extractCustomField(bitrixContact.UF_CRM_, fieldMapping.company)
    }
    if (fieldMapping.position && !position && bitrixContact.UF_CRM_) {
      position = extractCustomField(bitrixContact.UF_CRM_, fieldMapping.position)
    }
    if (fieldMapping.inn && !inn && bitrixContact.UF_CRM_) {
      inn = extractCustomField(bitrixContact.UF_CRM_, fieldMapping.inn)
    }
  }

  return {
    name: name.trim(),
    email: email?.trim() || undefined,
    phone: phone?.trim() || undefined,
    company: company?.trim() || undefined,
    position: position?.trim() || undefined,
    inn: inn?.trim() || undefined,
    userId,
  }
}

/**
 * Преобразует сделку из Bitrix24 в формат нашей CRM
 */
export function transformBitrix24Deal(
  bitrixDeal: Bitrix24Deal,
  contactId: number,
  userId: number,
  stage: string,
  pipelineId?: number | null,
  sourceId?: number | null,
  dealTypeId?: number | null
): {
  title: string
  amount: number
  currency: string
  stage: string
  contactId: number
  userId: number
  pipelineId?: number | null
  sourceId?: number | null
  dealTypeId?: number | null
} {
  const amount = bitrixDeal.OPPORTUNITY ? Number(bitrixDeal.OPPORTUNITY) : 0
  const currency = bitrixDeal.CURRENCY_ID || 'RUB'

  return {
    title: bitrixDeal.TITLE || 'Сделка без названия',
    amount,
    currency,
    stage,
    contactId,
    userId,
    pipelineId: pipelineId || null,
    sourceId: sourceId || null,
    dealTypeId: dealTypeId || null,
  }
}

/**
 * Преобразует этапы из Bitrix24 в формат нашей CRM
 */
export function transformBitrix24Stages(
  bitrixStages: Bitrix24Stage[]
): Array<{ name: string; color: string }> {
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ]

  return bitrixStages.map((stage, index) => ({
    name: stage.NAME,
    color: stage.COLOR || colors[index % colors.length],
  }))
}

/**
 * Извлекает значение кастомного поля из Bitrix24
 */
function extractCustomField(
  customFields: Record<string, any>,
  fieldIdentifier: string
): string | undefined {
  // Ищем по ключу (может быть UF_CRM_XXXXX или просто XXXXX)
  const key = fieldIdentifier.startsWith('UF_CRM_') 
    ? fieldIdentifier 
    : `UF_CRM_${fieldIdentifier}`

  const value = customFields[key]
  if (value !== undefined && value !== null) {
    return String(value)
  }

  // Ищем по частичному совпадению
  for (const [k, v] of Object.entries(customFields)) {
    if (k.toLowerCase().includes(fieldIdentifier.toLowerCase())) {
      return String(v)
    }
  }

  return undefined
}

