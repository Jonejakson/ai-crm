'use client'

import { useState, useEffect, useRef } from 'react'
import { FilePdfIcon, FileExcelIcon, TrashIcon } from './Icons'

interface File {
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
    email: string
  }
}

interface FilesManagerProps {
  entityType: 'contact' | 'deal' | 'task' | 'event'
  entityId: number
}

export default function FilesManager({ entityType, entityId }: FilesManagerProps) {
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchFiles()
  }, [entityType, entityId])

  const fetchFiles = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/files?entityType=${entityType}&entityId=${entityId}`)
      if (response.ok) {
        const data = await response.json()
        setFiles(data.files || [])
      }
    } catch (error) {
      console.error('Error fetching files:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return

    const file = fileList[0]
    
    // Проверка размера (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Размер файла не должен превышать 10MB')
      return
    }

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('entityType', entityType)
      formData.append('entityId', entityId.toString())

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        await fetchFiles()
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } else {
        const error = await response.json()
        alert(error.error || 'Ошибка при загрузке файла')
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Ошибка при загрузке файла')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (fileId: number) => {
    if (!confirm('Удалить файл?')) return

    try {
      const response = await fetch(`/api/files?id=${fileId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchFiles()
      } else {
        alert('Ошибка при удалении файла')
      }
    } catch (error) {
      console.error('Error deleting file:', error)
      alert('Ошибка при удалении файла')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <FilePdfIcon className="w-6 h-6" />
    if (mimeType.includes('pdf')) return <FilePdfIcon className="w-6 h-6" />
    if (mimeType.includes('word') || mimeType.includes('document')) return <FilePdfIcon className="w-6 h-6" />
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return <FileExcelIcon className="w-6 h-6" />
    if (mimeType.includes('zip') || mimeType.includes('archive')) return <FilePdfIcon className="w-6 h-6" />
    return <FilePdfIcon className="w-6 h-6" />
  }

  const isImage = (mimeType: string) => {
    return mimeType.startsWith('image/')
  }

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Зона загрузки */}
      <div
        ref={dropZoneRef}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
          dragActive
            ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
            : 'border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--background-soft)]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={(e) => handleFileUpload(e.target.files)}
          className="hidden"
          disabled={uploading}
        />
        <div className="space-y-3">
          <div className="text-4xl">📎</div>
          <div>
            <p className="text-sm font-medium text-[var(--foreground)] mb-1">
              Перетащите файл сюда или{' '}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-[var(--primary)] hover:underline font-semibold"
              >
                выберите файл
              </button>
            </p>
            <p className="text-xs text-[var(--muted)]">
              Максимальный размер: 10MB
            </p>
          </div>
          {uploading && (
            <div className="flex items-center justify-center gap-2 text-sm text-[var(--primary)]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
              <span>Загрузка...</span>
            </div>
          )}
        </div>
      </div>

      {/* Список файлов */}
      {files.length > 0 ? (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-4 p-4 rounded-xl bg-white/50 border border-[var(--border)] hover:border-[var(--primary)] transition-colors group"
            >
              {/* Превью изображения или иконка */}
              <div className="flex-shrink-0">
                {isImage(file.mimeType) ? (
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={file.url}
                      alt={file.originalName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Если изображение не загрузилось, показываем иконку
                        e.currentTarget.style.display = 'none'
                        const icon = getFileIcon(file.mimeType)
                        e.currentTarget.parentElement!.innerHTML = `<div class="w-full h-full flex items-center justify-center">${icon}</div>`
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-[var(--background-soft)] flex items-center justify-center text-3xl">
                    <span className="flex items-center">{getFileIcon(file.mimeType)}</span>
                  </div>
                )}
              </div>

              {/* Информация о файле */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[var(--foreground)] truncate">
                  {file.originalName}
                </p>
                <div className="flex items-center gap-3 text-xs text-[var(--muted)] mt-1">
                  <span>{formatFileSize(file.size)}</span>
                  <span>•</span>
                  <span>{new Date(file.createdAt).toLocaleDateString('ru-RU')}</span>
                  {file.user && (
                    <>
                      <span>•</span>
                      <span>{file.user.name}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Действия */}
              <div className="flex items-center gap-2">
                <a
                  href={file.url}
                  download={file.originalName}
                  className="px-3 py-2 rounded-lg text-sm text-[var(--primary)] hover:bg-[var(--primary-soft)] transition-colors"
                  title="Скачать"
                >
                  ⬇️
                </a>
                {isImage(file.mimeType) && (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-lg text-sm text-[var(--primary)] hover:bg-[var(--primary-soft)] transition-colors"
                    title="Открыть в новой вкладке"
                  >
                    👁️
                  </a>
                )}
                <button
                  onClick={() => handleDelete(file.id)}
                  className="px-3 py-2 rounded-lg text-sm text-[var(--error)] hover:bg-[var(--error-soft)] transition-colors opacity-0 group-hover:opacity-100"
                  title="Удалить"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-[var(--muted)]">
          <p className="text-sm">Нет загруженных файлов</p>
        </div>
      )}
    </div>
  )
}

