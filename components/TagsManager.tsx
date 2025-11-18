'use client'

import { useState, useEffect } from 'react'

interface Tag {
  id: number
  name: string
  color: string
}

interface TagsManagerProps {
  entityType: 'contact' | 'deal'
  entityId: number
  tags?: Tag[]
  onTagsChange?: () => void
}

export default function TagsManager({
  entityType,
  entityId,
  tags: initialTags = [],
  onTagsChange,
}: TagsManagerProps) {
  const [tags, setTags] = useState<Tag[]>(initialTags)
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3B82F6')
  const [creatingTag, setCreatingTag] = useState(false)

  const predefinedColors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // orange
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#84CC16', // lime
  ]

  useEffect(() => {
    loadTags()
    loadAvailableTags()
  }, [entityId])

  const loadTags = async () => {
    try {
      const response = await fetch(`/api/${entityType}s/${entityId}/tags`)
      if (response.ok) {
        const data = await response.json()
        setTags(data.tags || [])
      }
    } catch (error) {
      console.error('Error loading tags:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableTags = async () => {
    try {
      const response = await fetch('/api/tags')
      if (response.ok) {
        const data = await response.json()
        setAvailableTags(data.tags || [])
      }
    } catch (error) {
      console.error('Error loading available tags:', error)
    }
  }

  const handleAddTag = async (tagId: number) => {
    try {
      const response = await fetch(`/api/${entityType}s/${entityId}/tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tagId }),
      })

      if (response.ok) {
        const data = await response.json()
        setTags([...tags, data.tag])
        if (onTagsChange) {
          onTagsChange()
        }
      }
    } catch (error) {
      console.error('Error adding tag:', error)
    }
  }

  const handleRemoveTag = async (tagId: number) => {
    try {
      const response = await fetch(
        `/api/${entityType}s/${entityId}/tags?tagId=${tagId}`,
        {
          method: 'DELETE',
        }
      )

      if (response.ok) {
        setTags(tags.filter((t) => t.id !== tagId))
        if (onTagsChange) {
          onTagsChange()
        }
      }
    } catch (error) {
      console.error('Error removing tag:', error)
    }
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return

    setCreatingTag(true)
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newTagName.trim(),
          color: newTagColor,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        await loadAvailableTags()
        await handleAddTag(data.tag.id)
        setNewTagName('')
        setNewTagColor('#3B82F6')
        setShowAddModal(false)
      } else {
        const error = await response.json()
        alert(error.error || 'Ошибка создания тега')
      }
    } catch (error) {
      console.error('Error creating tag:', error)
      alert('Ошибка создания тега')
    } finally {
      setCreatingTag(false)
    }
  }

  const unassignedTags = availableTags.filter(
    (tag) => !tags.some((t) => t.id === tag.id)
  )

  if (loading) {
    return <div className="text-sm text-gray-500">Загрузка тегов...</div>
  }

  return (
    <div className="space-y-3">
      {/* Текущие теги */}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              onClick={() => handleRemoveTag(tag.id)}
              className="ml-1 hover:opacity-70"
              title="Удалить тег"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {/* Кнопка добавления тега */}
      <div className="relative">
        <button
          onClick={() => setShowAddModal(!showAddModal)}
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          + Добавить тег
        </button>

        {/* Модальное окно добавления тега */}
        {showAddModal && (
          <div className="absolute z-10 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
            <div className="space-y-3">
              {/* Список доступных тегов */}
              {unassignedTags.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-700 mb-2">
                    Выберите тег:
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {unassignedTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => {
                          handleAddTag(tag.id)
                          setShowAddModal(false)
                        }}
                        className="w-full text-left px-2 py-1 text-sm hover:bg-gray-100 rounded flex items-center gap-2"
                      >
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Создание нового тега */}
              <div className="border-t pt-3">
                <div className="text-xs font-medium text-gray-700 mb-2">
                  Создать новый тег:
                </div>
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Название тега"
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded mb-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateTag()
                    }
                  }}
                />
                <div className="flex gap-1 mb-2">
                  {predefinedColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewTagColor(color)}
                      className={`w-6 h-6 rounded border-2 ${
                        newTagColor === color
                          ? 'border-gray-800'
                          : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
                <button
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || creatingTag}
                  className="w-full px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingTag ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

