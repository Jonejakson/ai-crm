export type WebFormFieldKey = 'name' | 'email' | 'phone' | 'company' | 'message'

export interface WebFormFieldConfig {
  key: WebFormFieldKey
  label: string
  required: boolean
  enabled: boolean
  placeholder?: string
  order: number
}

export interface WebFormFieldsPayload {
  fields: WebFormFieldConfig[]
  submitButtonLabel?: string
}

export const WEBFORM_FIELD_LIBRARY: Record<WebFormFieldKey, Omit<WebFormFieldConfig, 'order'>> = {
  name: {
    key: 'name',
    label: 'Ваше имя',
    required: true,
    enabled: true,
    placeholder: 'Иван Иванов',
  },
  email: {
    key: 'email',
    label: 'Email',
    required: true,
    enabled: true,
    placeholder: 'example@mail.com',
  },
  phone: {
    key: 'phone',
    label: 'Телефон',
    required: false,
    enabled: true,
    placeholder: '+7 (999) 000-00-00',
  },
  company: {
    key: 'company',
    label: 'Компания',
    required: false,
    enabled: false,
    placeholder: 'Компания',
  },
  message: {
    key: 'message',
    label: 'Комментарий',
    required: false,
    enabled: true,
    placeholder: 'Расскажите, что вам интересно',
  },
}

export const DEFAULT_FORM_CONFIGURATION: WebFormFieldsPayload = {
  fields: Object.values(WEBFORM_FIELD_LIBRARY).map((field, index) => ({
    ...field,
    order: index,
  })),
  submitButtonLabel: 'Отправить',
}

export function sanitizeFormFields(input: any): WebFormFieldsPayload {
  if (!input || typeof input !== 'object') {
    return DEFAULT_FORM_CONFIGURATION
  }

  const config: WebFormFieldsPayload = {
    fields: [],
    submitButtonLabel:
      typeof input.submitButtonLabel === 'string' && input.submitButtonLabel.trim().length > 0
        ? input.submitButtonLabel.trim()
        : DEFAULT_FORM_CONFIGURATION.submitButtonLabel,
  }

  const usedKeys = new Set<string>()
  const rawFields = Array.isArray(input.fields) ? input.fields : []
  for (const raw of rawFields) {
    if (!raw || typeof raw !== 'object') continue
    const key = raw.key as WebFormFieldKey
    if (!key || !WEBFORM_FIELD_LIBRARY[key] || usedKeys.has(key)) continue
    usedKeys.add(key)

    config.fields.push({
      key,
      label:
        typeof raw.label === 'string' && raw.label.trim().length > 0
          ? raw.label.trim()
          : WEBFORM_FIELD_LIBRARY[key].label,
      required: typeof raw.required === 'boolean' ? raw.required : WEBFORM_FIELD_LIBRARY[key].required,
      enabled: raw.enabled !== false,
      placeholder:
        typeof raw.placeholder === 'string' ? raw.placeholder : WEBFORM_FIELD_LIBRARY[key].placeholder,
      order: typeof raw.order === 'number' ? raw.order : config.fields.length,
    })
  }

  // Гарантируем, что обязательные поля присутствуют
  const finalFields =
    config.fields.length > 0
      ? config.fields
      : DEFAULT_FORM_CONFIGURATION.fields.map((field) => ({ ...field }))

  // Сортируем по order
  finalFields.sort((a, b) => a.order - b.order)

  return {
    fields: finalFields,
    submitButtonLabel: config.submitButtonLabel || DEFAULT_FORM_CONFIGURATION.submitButtonLabel,
  }
}

export function getFieldLibraryList(): WebFormFieldConfig[] {
  return Object.values(WEBFORM_FIELD_LIBRARY).map((field, index) => ({
    ...field,
    order: index,
  }))
}

