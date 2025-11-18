'use client'

import { useState, useRef, useEffect } from 'react'

interface FileUploadProps {
  entityType: 'contact' | 'deal' | 'task' | 'event'
  entityId: number
  onUploadComplete?: () => void
}

interface FileItem {
  id: number
  name: string
  originalName: string
  url: string
  size: number
  mimeType: string
  createdAt: string
  user?: {
    id: number
    name: string
  }
}

export default function FileUpload({ entityType, entityId, onUploadComplete }: FileUploadProps) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadFiles = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/files?entityType=${entityType}&entityId=${entityId}`)
      if (response.ok) {
        const data = await response.json()
        setFiles(data.files || [])
      } else {
        setError('Ошибка загрузки файлов')
      }
    } catch (error) {
      console.error('Error loading files:', error)
      setError('Ошибка загрузки файлов')
    } finally {
      setLoading(false)
    }
  }

  // Загружаем файлы при монтировании
  useEffect(() => {
    loadFiles()
  }, [entityType, entityId])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) return

    setUploading(true)
    setError('')

    try {
      for (const file of Array.from(selectedFiles)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('entityType', entityType)
        formData.append('entityId', entityId.toString())

        const response = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Ошибка загрузки файла')
        }
      }

      await loadFiles()
      if (onUploadComplete) {
        onUploadComplete()
      }
    } catch (error: any) {
      setError(error.message || 'Ошибка загрузки файлов')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async (fileId: number) => {
    if (!confirm('Удалить этот файл?')) return

    try {
      const response = await fetch(`/api/files?id=${fileId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Ошибка удаления файла')
      }

      await loadFiles()
    } catch (error: any) {
      setError(error.message || 'Ошибка удаления файла')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType.includes('pdf')) return '📄'
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊'
    if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦'
    return '📎'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Файлы</h3>
        <label className="cursor-pointer">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />
          <span className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
            {uploading ? 'Загрузка...' : '+ Загрузить файл'}
          </span>
        </label>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-4 text-gray-500">Загрузка...</div>
      ) : files.length === 0 ? (
        <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-300 rounded-lg">
          Нет загруженных файлов
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-2xl">{getFileIcon(file.mimeType)}</span>
                <div className="flex-1 min-w-0">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-gray-900 hover:text-blue-600 truncate block"
                  >
                    {file.originalName}
                  </a>
                  <div className="text-xs text-gray-500">
                    {formatFileSize(file.size)} •{' '}
                    {new Date(file.createdAt).toLocaleDateString('ru-RU')}
                    {file.user && ` • ${file.user.name}`}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDelete(file.id)}
                className="ml-4 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Удалить"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

