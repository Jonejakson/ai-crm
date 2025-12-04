'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface CustomField {
  id: number
  name: string
  type: string
  entityType: string
  isRequired: boolean
  isUnique: boolean
  order: number
  options: string[] | null
  defaultValue: string | null
}

interface CustomFieldsManagerProps {
  entityType: 'contact' | 'deal' | 'task'
  onClose?: () => void
}

export default function CustomFieldsManager({
  entityType,
  onClose,
}: CustomFieldsManagerProps) {
  const [fields, setFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingField, setEditingField] = useState<CustomField | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'TEXT',
    isRequired: false,
    isUnique: false,
    order: 0,
    options: [] as string[],
    defaultValue: '',
  })
  const [newOption, setNewOption] = useState('')

  useEffect(() => {
    fetchFields()
  }, [entityType])

  const fetchFields = async () => {
    try {
      const response = await fetch(`/api/custom-fields?entityType=${entityType}`)
      const data = await response.json()
      setFields(data.map((f: any) => ({
        ...f,
        options: f.options || null,
      })))
    } catch (error) {
      console.error('Error fetching custom fields:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingField(null)
    setFormData({
      name: '',
      type: 'TEXT',
      isRequired: false,
      isUnique: false,
      order: 0,
      options: [],
      defaultValue: '',
    })
    setNewOption('')
    setIsModalOpen(true)
  }

  const handleEdit = (field: CustomField) => {
    setEditingField(field)
    setFormData({
      name: field.name,
      type: field.type,
      isRequired: field.isRequired,
      isUnique: field.isUnique,
      order: field.order,
      options: field.options || [],
      defaultValue: field.defaultValue || '',
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить это поле? Все его значения будут удалены.')) {
      return
    }

    try {
      const response = await fetch(`/api/custom-fields/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Поле удалено')
        await fetchFields()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при удалении поля')
      }
    } catch (error) {
      console.error('Error deleting field:', error)
      toast.error('Ошибка при удалении поля')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const payload = {
        ...formData,
        entityType,
        options:
          formData.type === 'SELECT' || formData.type === 'MULTISELECT'
            ? formData.options
            : undefined,
        defaultValue: formData.defaultValue || undefined,
      }

      const url = editingField
        ? `/api/custom-fields/${editingField.id}`
        : '/api/custom-fields'
      const method = editingField ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        toast.success(editingField ? 'Поле обновлено' : 'Поле создано')
        await fetchFields()
        setIsModalOpen(false)
        setEditingField(null)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при сохранении поля')
      }
    } catch (error) {
      console.error('Error saving field:', error)
      toast.error('Ошибка при сохранении поля')
    }
  }

  const addOption = () => {
    if (newOption.trim()) {
      setFormData({
        ...formData,
        options: [...formData.options, newOption.trim()],
      })
      setNewOption('')
    }
  }

  const removeOption = (index: number) => {
    setFormData({
      ...formData,
      options: formData.options.filter((_, i) => i !== index),
    })
  }

  const fieldTypes = [
    { value: 'TEXT', label: 'Текст' },
    { value: 'TEXTAREA', label: 'Многострочный текст' },
    { value: 'NUMBER', label: 'Число' },
    { value: 'DATE', label: 'Дата' },
    { value: 'EMAIL', label: 'Email' },
    { value: 'PHONE', label: 'Телефон' },
    { value: 'URL', label: 'URL' },
    { value: 'CHECKBOX', label: 'Чекбокс' },
    { value: 'SELECT', label: 'Выпадающий список' },
    { value: 'MULTISELECT', label: 'Множественный выбор' },
  ]

  if (loading) {
    return <div className="text-center py-4">Загрузка...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          Кастомные поля ({entityType === 'contact' ? 'Контакты' : entityType === 'deal' ? 'Сделки' : 'Задачи'})
        </h3>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors text-sm flex items-center gap-2"
        >
          <span>+</span> Добавить поле
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-12 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
          <p className="text-[var(--muted)] mb-4">Нет кастомных полей</p>
          <p className="text-sm text-[var(--muted)] mb-4">Создайте первое поле для этого типа сущности</p>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors text-sm"
          >
            + Создать поле
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field) => (
            <div
              key={field.id}
              className="flex items-center justify-between p-4 bg-[var(--surface)] rounded-lg border border-[var(--border)] hover:shadow-md transition-shadow"
            >
              <div className="flex-1">
                <div className="font-semibold text-[var(--foreground)]">{field.name}</div>
                <div className="text-sm text-[var(--muted)] mt-1">
                  {fieldTypes.find((t) => t.value === field.type)?.label || field.type}
                  {field.isRequired && <span className="ml-2 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs">Обязательное</span>}
                  {field.isUnique && <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">Уникальное</span>}
                  {field.options && <span className="ml-2 text-[var(--muted)]">{field.options.length} опций</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(field)}
                  className="px-3 py-1.5 text-sm text-[var(--primary)] hover:bg-[var(--primary-soft)] rounded-lg transition-colors"
                  title="Редактировать"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(field.id)}
                  className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Удалить"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модальное окно создания/редактирования */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-[var(--foreground)]">
                {editingField ? 'Редактировать поле' : 'Создать поле'}
              </h3>
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  setEditingField(null)
                }}
                className="text-[var(--muted)] hover:text-[var(--foreground)] text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Название поля *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Тип поля *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value, options: [] })
                  }
                  required
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                >
                  {fieldTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {(formData.type === 'SELECT' || formData.type === 'MULTISELECT') && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Варианты выбора *
                  </label>
                  <div className="space-y-2">
                    {formData.options.map((option, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 bg-[var(--background-soft)] rounded-lg border border-[var(--border)]"
                      >
                        <span className="flex-1 text-[var(--foreground)]">{option}</span>
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded px-2 py-1 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newOption}
                        onChange={(e) => setNewOption(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addOption()
                          }
                        }}
                        placeholder="Добавить вариант"
                        className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      />
                      <button
                        type="button"
                        onClick={addOption}
                        className="px-4 py-2 bg-[var(--background-soft)] text-[var(--foreground)] rounded-lg hover:bg-[var(--border)] transition-colors"
                      >
                        Добавить
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {formData.type !== 'SELECT' &&
                formData.type !== 'MULTISELECT' &&
                formData.type !== 'CHECKBOX' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Значение по умолчанию
                    </label>
                    <input
                      type={
                        formData.type === 'NUMBER'
                          ? 'number'
                          : formData.type === 'DATE'
                          ? 'date'
                          : 'text'
                      }
                      value={formData.defaultValue}
                      onChange={(e) =>
                        setFormData({ ...formData, defaultValue: e.target.value })
                      }
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>
                )}

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isRequired}
                    onChange={(e) =>
                      setFormData({ ...formData, isRequired: e.target.checked })
                    }
                  />
                  <span className="text-sm">Обязательное поле</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isUnique}
                    onChange={(e) =>
                      setFormData({ ...formData, isUnique: e.target.checked })
                    }
                  />
                  <span className="text-sm">Уникальное значение</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Порядок отображения
                </label>
                <input
                  type="number"
                  value={formData.order}
                  onChange={(e) =>
                    setFormData({ ...formData, order: parseInt(e.target.value) || 0 })
                  }
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setEditingField(null)
                  }}
                  className="px-4 py-2 border border-[var(--border)] bg-[var(--background-soft)] text-[var(--foreground)] rounded-lg hover:bg-[var(--border)] transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
                >
                  {editingField ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

