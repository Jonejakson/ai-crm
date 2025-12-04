'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import Modal from '@/components/Modal'
import { EmailTemplateIcon, EditIcon, TrashIcon, PlusIcon } from '@/components/Icons'

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
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: '',
    description: '',
  })

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
          {templates.map((template) => (
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
              
              <button
                onClick={() => handleUseTemplate(template)}
                className="w-full px-3 py-2 text-sm bg-[var(--background-soft)] hover:bg-[var(--primary-soft)] text-[var(--foreground)] rounded-lg transition-colors"
              >
                Использовать шаблон
              </button>
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
            <p className="text-xs text-[var(--muted)] mt-1">
              Можно использовать переменные: {'{{name}}'}, {'{{email}}'}, {'{{company}}'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Текст письма *
            </label>
            <textarea
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              rows={8}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
              placeholder="Текст письма"
              required
            />
            <p className="text-xs text-[var(--muted)] mt-1">
              Можно использовать переменные: {'{{name}}'}, {'{{email}}'}, {'{{company}}'}, {'{{phone}}'}
            </p>
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
    </div>
  )
}

