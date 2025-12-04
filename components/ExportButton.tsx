'use client'

import { useState, useRef, useEffect } from 'react'
import { DownloadIcon, FilePdfIcon, FileExcelIcon } from './Icons'

interface ExportButtonProps {
  entityType: 'deals' | 'contacts' | 'tasks' | 'events'
  label?: string
  className?: string
}

export default function ExportButton({ 
  entityType, 
  label = 'Экспорт',
  className = ''
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const getExportUrl = (format: 'csv' | 'excel' | 'pdf') => {
    const baseUrl = `/api/export/${entityType}`
    const params = new URLSearchParams({ format })
    return `${baseUrl}?${params.toString()}`
  }

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const url = getExportUrl(format)
    window.location.href = url
    setIsOpen(false)
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-secondary text-xs lg:text-sm flex items-center gap-1.5 px-3 py-2 whitespace-nowrap"
      >
        <DownloadIcon className="w-4 h-4" />
        <span>{label}</span>
        <svg 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg p-2 z-50 min-w-[180px]">
          <button
            onClick={() => handleExport('csv')}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--background-soft)] rounded-lg text-sm text-left transition-colors text-slate-800 dark:text-[var(--foreground)]"
          >
            <FilePdfIcon className="w-4 h-4" />
            <span>CSV</span>
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--background-soft)] rounded-lg text-sm text-left transition-colors text-slate-800 dark:text-[var(--foreground)]"
          >
            <FileExcelIcon className="w-4 h-4" />
            <span>Excel</span>
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--background-soft)] rounded-lg text-sm text-left transition-colors text-slate-800 dark:text-[var(--foreground)]"
          >
            <FilePdfIcon className="w-4 h-4" />
            <span>PDF</span>
          </button>
        </div>
      )}
    </div>
  )
}

