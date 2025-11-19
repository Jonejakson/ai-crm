'use client'

import { useState, useEffect } from 'react'

export default function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false)
  const [shortcuts, setShortcuts] = useState<Array<{ keys: string; description: string }>>([])

  useEffect(() => {
    // Показываем подсказку при нажатии Ctrl+?
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '?') {
        e.preventDefault()
        setIsOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    // Собираем все доступные сокращения со страницы
    const pageShortcuts: Array<{ keys: string; description: string }> = [
      { keys: 'Ctrl + K', description: 'Открыть поиск' },
      { keys: 'Ctrl + N', description: 'Создать новый элемент' },
      { keys: '/', description: 'Фокус на поиск' },
      { keys: 'Esc', description: 'Закрыть модальное окно' },
      { keys: 'Ctrl + ?', description: 'Показать эту справку' },
    ]

    setShortcuts(pageShortcuts)
  }, [])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="relative w-full max-w-2xl bg-[var(--surface)] rounded-3xl shadow-2xl border border-[var(--border)] p-6 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[var(--foreground)]">Клавиатурные сокращения</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-soft)] transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 rounded-xl bg-[var(--background-soft)] border border-[var(--border)]"
            >
              <span className="text-sm text-[var(--foreground)]">{shortcut.description}</span>
              <kbd className="px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] shadow-sm">
                {shortcut.keys}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsOpen(false)}
            className="btn-primary text-sm"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}

