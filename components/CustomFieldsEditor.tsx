'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface CustomField {
  id: number
  name: string
  type: string
  isRequired: boolean
  isUnique: boolean
  options: string[] | null
  defaultValue: string | null
}

interface CustomFieldValue {
  field: CustomField
  value: {
    id: number
    value: string | null
    parsedValue: string | string[] | null
  } | null
}

interface CustomFieldsEditorProps {
  entityType: 'contact' | 'deal' | 'task'
  entityId: number
  onSave?: () => void
}

export default function CustomFieldsEditor({
  entityType,
  entityId,
  onSave,
}: CustomFieldsEditorProps) {
  const [fields, setFields] = useState<CustomFieldValue[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState<Record<number, any>>({})

  useEffect(() => {
    fetchFields()
  }, [entityType, entityId])

  const fetchFields = async () => {
    try {
      const response = await fetch(
        `/api/custom-fields/values?entityType=${entityType}&entityId=${entityId}`
      )
      const data = await response.json()
      setFields(data)

      // Инициализация значений
      const initialValues: Record<number, any> = {}
      data.forEach((item: CustomFieldValue) => {
        if (item.value) {
          initialValues[item.field.id] = item.value.parsedValue
        } else if (item.field.defaultValue) {
          initialValues[item.field.id] = item.field.defaultValue
        } else {
          initialValues[item.field.id] =
            item.field.type === 'CHECKBOX' ? false : item.field.type === 'MULTISELECT' ? [] : ''
        }
      })
      setValues(initialValues)
    } catch (error) {
      console.error('Error fetching custom fields:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const valuesArray = Object.entries(values).map(([fieldId, value]) => ({
        fieldId: parseInt(fieldId),
        value,
      }))

      const response = await fetch('/api/custom-fields/values', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityType,
          entityId,
          values: valuesArray,
        }),
      })

      if (response.ok) {
        toast.success('Кастомные поля сохранены')
        await fetchFields()
        if (onSave) {
          onSave()
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при сохранении')
      }
    } catch (error) {
      console.error('Error saving custom fields:', error)
      toast.error('Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  const updateValue = (fieldId: number, value: any) => {
    setValues({ ...values, [fieldId]: value })
  }

  const renderField = (item: CustomFieldValue) => {
    const { field, value } = item
    const currentValue = values[field.id] ?? (value?.parsedValue ?? field.defaultValue ?? '')

    switch (field.type) {
      case 'TEXT':
      case 'EMAIL':
      case 'PHONE':
      case 'URL':
        return (
          <input
            type={
              field.type === 'EMAIL'
                ? 'email'
                : field.type === 'PHONE'
                ? 'tel'
                : field.type === 'URL'
                ? 'url'
                : 'text'
            }
            value={currentValue || ''}
            onChange={(e) => updateValue(field.id, e.target.value)}
            required={field.isRequired}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            placeholder={field.defaultValue || ''}
          />
        )

      case 'TEXTAREA':
        return (
          <textarea
            value={currentValue || ''}
            onChange={(e) => updateValue(field.id, e.target.value)}
            required={field.isRequired}
            rows={3}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
            placeholder={field.defaultValue || ''}
          />
        )

      case 'NUMBER':
        return (
          <input
            type="number"
            value={currentValue || ''}
            onChange={(e) => updateValue(field.id, e.target.value ? parseFloat(e.target.value) : '')}
            required={field.isRequired}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            placeholder={field.defaultValue || ''}
          />
        )

      case 'DATE':
        return (
          <input
            type="date"
            value={currentValue || ''}
            onChange={(e) => updateValue(field.id, e.target.value)}
            required={field.isRequired}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        )

      case 'CHECKBOX':
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={currentValue === true || currentValue === 'true'}
              onChange={(e) => updateValue(field.id, e.target.checked)}
              className="w-4 h-4"
            />
                <span className="text-sm text-[var(--foreground)]">Да</span>
          </label>
        )

      case 'SELECT':
        return (
          <select
            value={currentValue || ''}
            onChange={(e) => updateValue(field.id, e.target.value)}
            required={field.isRequired}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          >
            <option value="">Выберите...</option>
            {field.options?.map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
        )

      case 'MULTISELECT':
        const selectedValues = Array.isArray(currentValue) ? currentValue : []
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => (
              <label key={index} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option)}
                  onChange={(e) => {
                    const newValues = e.target.checked
                      ? [...selectedValues, option]
                      : selectedValues.filter((v) => v !== option)
                    updateValue(field.id, newValues)
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm text-[var(--foreground)]">{option}</span>
              </label>
            ))}
          </div>
        )

      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (fields.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--muted)] text-sm">
        <p>Нет кастомных полей для этого типа сущности</p>
        <p className="text-xs mt-2">Создайте поля в разделе "Кастомные поля"</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {fields.map((item) => (
        <div key={item.field.id} className="space-y-1">
          <label className="block text-sm font-medium text-[var(--foreground)]">
            {item.field.name}
            {item.field.isRequired && <span className="text-red-500 ml-1">*</span>}
            {item.field.isUnique && (
              <span className="text-xs text-[var(--muted)] ml-2">(уникальное)</span>
            )}
          </label>
          {renderField(item)}
        </div>
      ))}

      <div className="flex justify-end pt-4 border-t border-[var(--border)]">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}

