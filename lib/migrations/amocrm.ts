// Утилиты для преобразования данных из AmoCRM в формат нашей CRM

export interface AmoCRMContact {
  id: number
  name: string
  first_name?: string
  last_name?: string
  responsible_user_id?: number
  created_by?: number
  created_at?: number
  updated_at?: number
  custom_fields_values?: Array<{
    field_id: number
    field_name: string
    values: Array<{
      value: string | number
      enum_id?: number
      enum_code?: string
    }>
  }>
}

export interface AmoCRMDeal {
  id: number
  name: string
  price?: number
  responsible_user_id?: number
  created_by?: number
  created_at?: number
  updated_at?: number
  status_id?: number
  pipeline_id?: number
  contacts?: {
    id: number
  }[]
  custom_fields_values?: Array<{
    field_id: number
    field_name: string
    values: Array<{
      value: string | number
      enum_id?: number
      enum_code?: string
    }>
  }>
}

export interface AmoCRMPipeline {
  id: number
  name: string
  statuses?: Array<{
    id: number
    name: string
    color?: string
  }>
}

/**
 * Преобразует контакт из AmoCRM в формат нашей CRM
 */
export function transformAmoCRMContact(
  amoContact: AmoCRMContact,
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
  // Извлекаем email и телефон из кастомных полей
  let email: string | undefined
  let phone: string | undefined
  let company: string | undefined
  let position: string | undefined
  let inn: string | undefined

  if (amoContact.custom_fields_values) {
    for (const field of amoContact.custom_fields_values) {
      const value = field.values?.[0]?.value
      if (!value) continue

      const fieldName = field.field_name?.toLowerCase() || ''
      
      // Стандартные поля AmoCRM
      if (fieldName.includes('email') || field.field_id === 1) {
        email = String(value)
      } else if (fieldName.includes('phone') || field.field_id === 2) {
        phone = String(value)
      } else if (fieldName.includes('company') || fieldName.includes('компания')) {
        company = String(value)
      } else if (fieldName.includes('position') || fieldName.includes('должность')) {
        position = String(value)
      } else if (fieldName.includes('inn') || fieldName.includes('инн')) {
        inn = String(value)
      }
    }
  }

  // Формируем имя
  let name = amoContact.name
  if (!name && (amoContact.first_name || amoContact.last_name)) {
    name = [amoContact.first_name, amoContact.last_name].filter(Boolean).join(' ')
  }
  if (!name) {
    name = email || phone || 'Без имени'
  }

  // Применяем маппинг полей, если указан
  if (fieldMapping) {
    if (fieldMapping.email && !email) {
      email = extractFieldValue(amoContact, fieldMapping.email)
    }
    if (fieldMapping.phone && !phone) {
      phone = extractFieldValue(amoContact, fieldMapping.phone)
    }
    if (fieldMapping.company && !company) {
      company = extractFieldValue(amoContact, fieldMapping.company)
    }
    if (fieldMapping.position && !position) {
      position = extractFieldValue(amoContact, fieldMapping.position)
    }
    if (fieldMapping.inn && !inn) {
      inn = extractFieldValue(amoContact, fieldMapping.inn)
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
 * Преобразует сделку из AmoCRM в формат нашей CRM
 */
export function transformAmoCRMDeal(
  amoDeal: AmoCRMDeal,
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
  const amount = amoDeal.price ? Number(amoDeal.price) / 100 : 0 // AmoCRM хранит сумму в копейках

  return {
    title: amoDeal.name || 'Сделка без названия',
    amount,
    currency: 'RUB',
    stage,
    contactId,
    userId,
    pipelineId: pipelineId || null,
    sourceId: sourceId || null,
    dealTypeId: dealTypeId || null,
  }
}

/**
 * Преобразует воронку из AmoCRM в формат нашей CRM
 */
export function transformAmoCRMPipeline(
  amoPipeline: AmoCRMPipeline
): Array<{ name: string; color: string }> {
  if (!amoPipeline.statuses || amoPipeline.statuses.length === 0) {
    return []
  }

  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ]

  return amoPipeline.statuses.map((status, index) => ({
    name: status.name,
    color: status.color || colors[index % colors.length],
  }))
}

/**
 * Извлекает значение поля из контакта/сделки AmoCRM
 */
function extractFieldValue(
  entity: AmoCRMContact | AmoCRMDeal,
  fieldIdentifier: string
): string | undefined {
  if (!entity.custom_fields_values) return undefined

  // Может быть ID поля или название
  const fieldId = parseInt(fieldIdentifier)
  const isId = !isNaN(fieldId)

  for (const field of entity.custom_fields_values) {
    if (
      (isId && field.field_id === fieldId) ||
      (!isId && field.field_name?.toLowerCase() === fieldIdentifier.toLowerCase())
    ) {
      return field.values?.[0]?.value ? String(field.values[0].value) : undefined
    }
  }

  return undefined
}

