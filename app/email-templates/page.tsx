'use client'

import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import Modal from '@/components/Modal'
import { EmailTemplateIcon, EditIcon, TrashIcon, PlusIcon, SearchIcon } from '@/components/Icons'
import { replaceTemplateVariables, getAvailableVariables, validateTemplate, type TemplateContext } from '@/lib/email-template-utils'

interface EmailTemplate {
  id: number
  name: string
  subject: string
  body: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: '',
    description: '',
  })
  const [showVariables, setShowVariables] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/email-templates')
      if (!response.ok) {
        throw new Error('Ошибка при загрузке шаблонов')
      }
      const data = await response.json()
      setTemplates(data)
    } catch (error: any) {
      console.error('Error fetching templates:', error)
      toast.error(error.message || 'Ошибка при загрузке шаблонов')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (template?: EmailTemplate) => {
    if (template) {
      setEditingTemplate(template)
      setFormData({
        name: template.name,
        subject: template.subject,
        body: template.body,
        description: template.description || '',
      })
    } else {
      setEditingTemplate(null)
      setFormData({
        name: '',
        subject: '',
        body: '',
        description: '',
      })
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingTemplate(null)
    setFormData({
      name: '',
      subject: '',
      body: '',
      description: '',
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.subject.trim() || !formData.body.trim()) {
      toast.error('Заполните все обязательные поля')
      return
    }

    try {
      const url = editingTemplate
        ? `/api/email-templates/${editingTemplate.id}`
        : '/api/email-templates'
      
      const method = editingTemplate ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Ошибка при сохранении шаблона')
      }

      toast.success(editingTemplate ? 'Шаблон обновлен' : 'Шаблон создан')
      handleCloseModal()
      fetchTemplates()
    } catch (error: any) {
      console.error('Error saving template:', error)
      toast.error(error.message || 'Ошибка при сохранении шаблона')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот шаблон?')) {
      return
    }

    try {
      const response = await fetch(`/api/email-templates/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Ошибка при удалении шаблона')
      }

      toast.success('Шаблон удален')
      fetchTemplates()
    } catch (error: any) {
      console.error('Error deleting template:', error)
      toast.error(error.message || 'Ошибка при удалении шаблона')
    }
  }

  const handleUseTemplate = (template: EmailTemplate) => {
    // Копируем шаблон в буфер обмена
    const templateText = `Тема: ${template.subject}\n\n${template.body}`
    navigator.clipboard.writeText(templateText)
    toast.success('Шаблон скопирован в буфер обмена')
  }

  const handlePreview = (template: EmailTemplate) => {
    setPreviewTemplate(template)
    setIsPreviewOpen(true)
  }

  // Фильтрация шаблонов по поисковому запросу
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates
    
    const query = searchQuery.toLowerCase()
    return templates.filter(
      (template) =>
        template.name.toLowerCase().includes(query) ||
        template.subject.toLowerCase().includes(query) ||
        template.body.toLowerCase().includes(query) ||
        (template.description && template.description.toLowerCase().includes(query))
    )
  }, [templates, searchQuery])

  // Валидация переменных при изменении формы
  useEffect(() => {
    const allText = `${formData.subject} ${formData.body}`
    const availableVars = getAvailableVariables({})
    const validation = validateTemplate(allText, availableVars)
    
    if (validation.unknownVariables.length > 0) {
      setValidationErrors(
        validation.unknownVariables.map((v) => `Неизвестная переменная: ${v}`)
      )
    } else {
      setValidationErrors([])
    }
  }, [formData.subject, formData.body])

  // Контекст для предпросмотра (примерные данные)
  const previewContext: TemplateContext = {
    contact: {
      name: 'Иван Иванов',
      email: 'ivan@example.com',
      phone: '+7 (999) 123-45-67',
      company: 'ООО "Пример"',
      position: 'Директор',
    },
    deal: {
      title: 'Продажа товара',
      amount: 100000,
      currency: 'RUB',
      stage: 'Переговоры',
      probability: 75,
    },
    manager: {
      name: 'Менеджер Петров',
      email: 'manager@example.com',
    },
    company: {
      name: 'Ваша компания',
    },
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
            Шаблоны писем
          </h1>
          <p className="text-[var(--muted)]">
            Создавайте и управляйте шаблонами для быстрой отправки писем
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          Создать шаблон
        </button>
      </div>

      {/* Поиск */}
      {templates.length > 0 && (
        <div className="mb-6">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию, теме или тексту..."
              className="w-full pl-10 pr-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          {searchQuery && (
            <p className="text-sm text-[var(--muted)] mt-2">
              Найдено шаблонов: {filteredTemplates.length}
            </p>
          )}
        </div>
      )}

      {templates.length === 0 ? (
        <div className="text-center py-12 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
          <EmailTemplateIcon className="w-16 h-16 mx-auto mb-4 text-[var(--muted)]" />
          <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)]">
            Нет шаблонов
          </h3>
          <p className="text-[var(--muted)] mb-4">
            Создайте первый шаблон для быстрой отправки писем
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
          >
            Создать шаблон
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="bg-[var(--surface)] rounded-lg border border-[var(--border)] p-5 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-semibold text-[var(--foreground)]">
                  {template.name}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenModal(template)}
                    className="p-1.5 text-[var(--muted)] hover:text-[var(--primary)] transition-colors"
                    title="Редактировать"
                  >
                    <EditIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-1.5 text-[var(--muted)] hover:text-red-500 transition-colors"
                    title="Удалить"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {template.description && (
                <p className="text-sm text-[var(--muted)] mb-3">
                  {template.description}
                </p>
              )}
              
              <div className="mb-3">
                <p className="text-xs text-[var(--muted)] mb-1">Тема:</p>
                <p className="text-sm font-medium text-[var(--foreground)] line-clamp-1">
                  {template.subject}
                </p>
              </div>
              
              <div className="mb-4">
                <p className="text-xs text-[var(--muted)] mb-1">Текст:</p>
                <p className="text-sm text-[var(--foreground)] line-clamp-3">
                  {template.body}
                </p>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handlePreview(template)}
                  className="flex-1 px-3 py-2 text-sm bg-[var(--background-soft)] hover:bg-blue-100 dark:hover:bg-blue-900 text-[var(--foreground)] rounded-lg transition-colors"
                >
                  Предпросмотр
                </button>
                <button
                  onClick={() => handleUseTemplate(template)}
                  className="flex-1 px-3 py-2 text-sm bg-[var(--background-soft)] hover:bg-[var(--primary-soft)] text-[var(--foreground)] rounded-lg transition-colors"
                >
                  Использовать
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingTemplate ? 'Редактировать шаблон' : 'Создать шаблон'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Название шаблона *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="Например: Приветственное письмо"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Описание
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="Краткое описание шаблона"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Тема письма *
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="Тема письма"
              required
            />
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowVariables(!showVariables)}
                className="text-xs text-[var(--primary)] hover:underline"
              >
                {showVariables ? 'Скрыть' : 'Показать'} доступные переменные
              </button>
              {showVariables && (
                <div className="mt-2 p-3 bg-[var(--background-soft)] rounded-lg text-xs">
                  <p className="font-semibold mb-2">Доступные переменные:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="font-medium mb-1">Контакт:</p>
                      <code className="block text-[var(--muted)]">{'{{name}}'}</code>
                      <code className="block text-[var(--muted)]">{'{{email}}'}</code>
                      <code className="block text-[var(--muted)]">{'{{phone}}'}</code>
                      <code className="block text-[var(--muted)]">{'{{company}}'}</code>
                      <code className="block text-[var(--muted)]">{'{{position}}'}</code>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Сделка:</p>
                      <code className="block text-[var(--muted)]">{'{{deal_title}}'}</code>
                      <code className="block text-[var(--muted)]">{'{{deal_amount}}'}</code>
                      <code className="block text-[var(--muted)]">{'{{deal_stage}}'}</code>
                      <code className="block text-[var(--muted)]">{'{{deal_probability}}'}</code>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Менеджер:</p>
                      <code className="block text-[var(--muted)]">{'{{manager_name}}'}</code>
                      <code className="block text-[var(--muted)]">{'{{manager_email}}'}</code>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Системные:</p>
                      <code className="block text-[var(--muted)]">{'{{current_date}}'}</code>
                      <code className="block text-[var(--muted)]">{'{{current_time}}'}</code>
                      <code className="block text-[var(--muted)]">{'{{current_datetime}}'}</code>
                      <code className="block text-[var(--muted)]">{'{{company_name}}'}</code>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {validationErrors.length > 0 && (
              <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-400">
                {validationErrors.map((error, idx) => (
                  <p key={idx}>{error}</p>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Текст письма * (поддерживается HTML)
            </label>
            <textarea
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              rows={10}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none font-mono text-sm"
              placeholder="Текст письма (можно использовать HTML: &lt;b&gt;, &lt;i&gt;, &lt;br&gt;, &lt;p&gt; и т.д.)"
              required
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 text-[var(--foreground)] bg-[var(--background-soft)] rounded-lg hover:bg-[var(--border)] transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
            >
              {editingTemplate ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Модальное окно предпросмотра */}
      <Modal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} title="Предпросмотр шаблона">
        {previewTemplate && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-[var(--muted)] mb-1">Тема:</p>
              <p className="text-base font-semibold text-[var(--foreground)]">
                {replaceTemplateVariables(previewTemplate.subject, previewContext)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--muted)] mb-1">Текст:</p>
              <div 
                className="p-4 bg-[var(--background-soft)] rounded-lg border border-[var(--border)] text-[var(--foreground)] whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ 
                  __html: replaceTemplateVariables(previewTemplate.body, previewContext).replace(/\n/g, '<br/>') 
                }}
              />
            </div>
            <div className="pt-4 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--muted)] mb-2">Используемые переменные:</p>
              <div className="flex flex-wrap gap-2">
                {getAvailableVariables(previewContext).map((variable) => {
                  const text = `${previewTemplate.subject} ${previewTemplate.body}`
                  const isUsed = text.includes(variable)
                  return (
                    <span
                      key={variable}
                      className={`px-2 py-1 rounded text-xs ${
                        isUsed
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {variable}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

