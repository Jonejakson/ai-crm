/**
 * Zod схемы для валидации входных данных API
 */

import { z } from 'zod'

// Базовые схемы
export const emailSchema = z.string().email('Неверный формат email').optional().nullable()
export const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Неверный формат телефона').optional().nullable()
export const urlSchema = z.string().url('Неверный формат URL').optional().nullable()

// Контакты
export const createContactSchema = z.object({
  name: z.string().min(1, 'Имя обязательно').max(255, 'Имя слишком длинное'),
  email: emailSchema,
  phone: phoneSchema,
  company: z.string().max(255).optional().nullable(),
  position: z.string().max(255).optional().nullable(),
  inn: z.string().max(20).optional().nullable(),
})

export const updateContactSchema = createContactSchema.partial().extend({
  id: z.number().int().positive(),
})

// Сделки
export const createDealSchema = z.object({
  title: z.string().min(1, 'Название обязательно').max(255, 'Название слишком длинное'),
  amount: z.number().min(0, 'Сумма не может быть отрицательной').optional().default(0),
  currency: z.string().length(3, 'Валюта должна быть 3 символа').optional().default('RUB'),
  stage: z.string().max(100).optional(),
  contactId: z.number().int().positive('ID контакта обязателен'),
  pipelineId: z.number().int().positive().optional().nullable(),
  sourceId: z.number().int().positive().optional().nullable(),
  dealTypeId: z.number().int().positive().optional().nullable(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  probability: z.number().int().min(0).max(100).optional().default(0),
})

export const updateDealSchema = createDealSchema.partial().extend({
  id: z.number().int().positive(),
})

// Задачи
export const createTaskSchema = z.object({
  title: z.string().min(1, 'Название обязательно').max(255),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional().default('pending'),
  dueDate: z.string().datetime().optional().nullable(),
  contactId: z.number().int().positive().optional().nullable(),
})

export const updateTaskSchema = createTaskSchema.partial().extend({
  id: z.number().int().positive(),
})

// События
export const createEventSchema = z.object({
  title: z.string().min(1, 'Название обязательно').max(255),
  description: z.string().max(5000).optional().nullable(),
  startDate: z.string().datetime('Неверный формат даты начала'),
  endDate: z.string().datetime('Неверный формат даты окончания').optional().nullable(),
  location: z.string().max(255).optional().nullable(),
  type: z.enum(['meeting', 'call', 'task', 'other']).optional().default('meeting'),
  contactId: z.number().int().positive().optional().nullable(),
})

export const updateEventSchema = createEventSchema.partial().extend({
  id: z.number().int().positive(),
})

// Веб-формы
export const createWebFormSchema = z.object({
  name: z.string().min(1, 'Название обязательно').max(255),
  displayType: z.enum(['inline', 'popup']).optional().default('inline'),
  buttonText: z.string().max(100).optional().nullable(),
  fields: z.any(), // JSON структура
  successMessage: z.string().max(500).optional().nullable(),
  redirectUrl: urlSchema,
  sourceId: z.number().int().positive().optional().nullable(),
  pipelineId: z.number().int().positive().optional().nullable(),
  initialStage: z.string().max(100).optional().nullable(),
  defaultAssigneeId: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional().default(true),
})

export const updateWebFormSchema = createWebFormSchema.partial().extend({
  id: z.number().int().positive(),
})

// Email интеграции
export const createEmailIntegrationSchema = z.object({
  provider: z.enum(['GMAIL', 'OUTLOOK', 'IMAP_SMTP', 'YANDEX']),
  email: z.string().email('Неверный формат email'),
  displayName: z.string().max(255).optional().nullable(),
  password: z.string().min(1, 'Пароль обязателен').optional(), // Для IMAP/SMTP
  imapHost: z.string().max(255).optional().nullable(),
  imapPort: z.number().int().min(1).max(65535).optional().nullable(),
  imapUsername: z.string().max(255).optional().nullable(),
  imapPassword: z.string().optional().nullable(),
  imapSecure: z.boolean().optional().default(true),
  smtpHost: z.string().max(255).optional().nullable(),
  smtpPort: z.number().int().min(1).max(65535).optional().nullable(),
  smtpUsername: z.string().max(255).optional().nullable(),
  smtpPassword: z.string().optional().nullable(),
  smtpSecure: z.boolean().optional().default(true),
  useSSL: z.boolean().optional().default(true),
  accessToken: z.string().optional().nullable(), // Для OAuth
  refreshToken: z.string().optional().nullable(), // Для OAuth
  tokenExpiresAt: z.string().datetime().optional().nullable(),
  syncInterval: z.number().int().min(1).max(60).optional().default(5),
  isIncomingEnabled: z.boolean().optional().default(true),
  isOutgoingEnabled: z.boolean().optional().default(true),
  autoCreateContact: z.boolean().optional().default(true),
  autoCreateDeal: z.boolean().optional().default(false),
  defaultSourceId: z.number().int().positive().optional().nullable(),
  defaultPipelineId: z.number().int().positive().optional().nullable(),
  defaultAssigneeId: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  settings: z.any().optional().nullable(),
})

export const updateEmailIntegrationSchema = createEmailIntegrationSchema.partial().extend({
  id: z.number().int().positive(),
})

// Webhook интеграции
export const createWebhookSchema = z.object({
  name: z.string().min(1, 'Название обязательно').max(255),
  description: z.string().max(500).optional().nullable(),
  url: urlSchema.optional().nullable(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional().default('POST'),
  autoCreateContact: z.boolean().optional().default(true),
  autoCreateDeal: z.boolean().optional().default(false),
  defaultSourceId: z.number().int().positive().optional().nullable(),
  defaultPipelineId: z.number().int().positive().optional().nullable(),
  defaultAssigneeId: z.number().int().positive().optional().nullable(),
  fieldMapping: z.record(z.string(), z.any()).optional().nullable(), // JSON объект для маппинга полей
  settings: z.record(z.string(), z.any()).optional().nullable(), // JSON объект для дополнительных настроек
  isActive: z.boolean().optional().default(true),
})

export const updateWebhookSchema = createWebhookSchema.partial().extend({
  id: z.number().int().positive(),
})

// Пайплайны
export const createPipelineSchema = z.object({
  name: z.string().min(1, 'Название обязательно').max(255),
  stages: z.string(), // JSON строка
  isDefault: z.boolean().optional().default(false),
})

export const updatePipelineSchema = createPipelineSchema.partial().extend({
  id: z.number().int().positive(),
})

// Комментарии
export const createCommentSchema = z.object({
  text: z.string().min(1, 'Текст комментария обязателен').max(5000),
  entityType: z.enum(['deal', 'task', 'contact', 'event']),
  entityId: z.number().int().positive('ID сущности обязателен'),
})

export const updateCommentSchema = createCommentSchema.partial().extend({
  id: z.number().int().positive(),
})

// Пользователи
export const createUserSchema = z.object({
  email: z.string().email('Неверный формат email'),
  password: z.string().min(6, 'Пароль должен быть не менее 6 символов'),
  name: z.string().min(1, 'Имя обязательно').max(255),
  lastName: z.string().max(255).optional().nullable(),
  // Телефон: принимаем любой формат, очистка будет в API
  phone: z.string().min(1, 'Контактный номер обязателен'),
  role: z.enum(['admin', 'manager', 'user']).optional().default('user'),
  companyId: z.number().int().positive().optional(),
  userType: z.enum(['individual', 'legal']).optional().default('individual'),
  companyName: z.string().max(255).optional(),
  // ИНН: принимаем любой формат, очистка будет в API
  inn: z.string().optional(),
}).refine((data) => {
  // Для юр лица ИНН и название компании обязательны
  if (data.userType === 'legal') {
    const cleanInn = data.inn ? data.inn.replace(/\s/g, '') : ''
    if (!cleanInn || cleanInn.length < 10 || !data.companyName || data.companyName.trim() === '') {
      return false
    }
  }
  return true
}, {
  message: 'Для юридического лица необходимо указать название компании и ИНН',
  path: ['inn'], // Показываем ошибку на поле ИНН
})

// Создание пользователя админом внутри компании (без полей регистрации)
export const createCompanyUserSchema = z.object({
  email: z.string().email('Неверный формат email'),
  password: z.string().min(6, 'Пароль должен быть не менее 6 символов'),
  name: z.string().min(1, 'Имя обязательно').max(255),
  role: z.enum(['admin', 'manager', 'user']).optional().default('manager'),
})

export const updateUserSchema = createUserSchema.partial().extend({
  id: z.number().int().positive(),
}).omit({ password: true }) // Пароль обновляется отдельно

// Пагинация
export const paginationSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(50),
})

// Поиск
export const searchSchema = z.object({
  query: z.string().min(1, 'Поисковый запрос обязателен').max(255),
  type: z.enum(['all', 'contacts', 'deals', 'tasks', 'events']).optional().default('all'),
})

// Отправка email
export const sendEmailSchema = z.object({
  to: z.string().email('Неверный формат email получателя'),
  subject: z.string().min(1, 'Тема обязательна').max(255),
  body: z.string().min(1, 'Текст письма обязателен').max(10000),
  contactId: z.number().int().positive().optional(),
  dealId: z.number().int().positive().optional(),
})

// Отправка сообщения в диалог
export const createDialogSchema = z.object({
  message: z.string().min(1, 'Сообщение обязательно').max(5000),
  sender: z.enum(['user', 'client']).optional().default('user'),
  platform: z.enum(['INTERNAL', 'TELEGRAM', 'WHATSAPP']).optional().default('INTERNAL'),
  contactId: z.number().int().positive('ID контакта обязателен'),
  externalId: z.string().max(255).optional().nullable(),
})

