'use client'

import { useState, useEffect } from 'react'

interface Comment {
  id: number
  text: string
  createdAt: string
  updatedAt: string
  user: {
    id: number
    name: string
    email: string
  }
}

interface CommentsProps {
  entityType: 'deal' | 'task'
  entityId: number
  currentUserId?: number
}

export default function Comments({ entityType, entityId, currentUserId }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')

  const loadComments = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(
        `/api/comments?entityType=${entityType}&entityId=${entityId}`
      )
      if (response.ok) {
        const data = await response.json()
        setComments(data.comments || [])
      } else {
        setError('Ошибка загрузки комментариев')
      }
    } catch (error) {
      console.error('Error loading comments:', error)
      setError('Ошибка загрузки комментариев')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadComments()
  }, [entityType, entityId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: newComment,
          entityType,
          entityId,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setComments([...comments, data.comment])
        setNewComment('')
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Ошибка создания комментария')
      }
    } catch (error) {
      console.error('Error creating comment:', error)
      setError('Ошибка создания комментария')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId: number) => {
    if (!confirm('Удалить этот комментарий?')) return

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setComments(comments.filter((c) => c.id !== commentId))
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Ошибка удаления комментария')
      }
    } catch (error) {
      console.error('Error deleting comment:', error)
      setError('Ошибка удаления комментария')
    }
  }

  const handleEdit = async (commentId: number) => {
    if (!editText.trim()) {
      setEditingId(null)
      return
    }

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: editText }),
      })

      if (response.ok) {
        const data = await response.json()
        setComments(
          comments.map((c) => (c.id === commentId ? data.comment : c))
        )
        setEditingId(null)
        setEditText('')
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Ошибка обновления комментария')
      }
    } catch (error) {
      console.error('Error updating comment:', error)
      setError('Ошибка обновления комментария')
    }
  }

  const startEdit = (comment: Comment) => {
    setEditingId(comment.id)
    setEditText(comment.text)
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">Загрузка комментариев...</div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* Форма добавления комментария */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Добавить комментарий..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows={3}
          disabled={submitting}
        />
        <div className="flex justify-center">
          <button
            type="submit"
            disabled={submitting || !newComment.trim()}
            className="btn-primary text-sm"
            style={{ width: '70%' }}
          >
            {submitting ? 'Отправка...' : 'Отправить'}
          </button>
        </div>
      </form>

      {/* Список комментариев */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            Пока нет комментариев
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-semibold text-gray-900">
                    {comment.user.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(comment.createdAt).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {comment.updatedAt !== comment.createdAt && ' (изменено)'}
                  </div>
                </div>
                {currentUserId === comment.user.id && (
                  <div className="flex gap-2">
                    {editingId === comment.id ? (
                      <>
                        <button
                          onClick={() => handleEdit(comment.id)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Сохранить
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null)
                            setEditText('')
                          }}
                          className="text-xs text-gray-600 hover:text-gray-800"
                        >
                          Отмена
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(comment)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Редактировать
                        </button>
                        <button
                          onClick={() => handleDelete(comment.id)}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Удалить
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {editingId === comment.id ? (
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                />
              ) : (
                <p className="text-gray-700 whitespace-pre-wrap">{comment.text}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

