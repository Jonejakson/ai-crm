'use client'

import { useEffect } from 'react'

interface Shortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  action: () => void
  description: string
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      shortcuts.forEach((shortcut) => {
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
        const altMatch = shortcut.alt ? e.altKey : !e.altKey
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          e.preventDefault()
          shortcut.action()
        }
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}

export function useGlobalShortcuts() {
  useKeyboardShortcuts([
    {
      key: 'k',
      ctrl: true,
      action: () => {
        // Фокус на поиск
        const searchInput = document.querySelector('input[type="text"][placeholder*="Поиск"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
          searchInput.select()
        }
      },
      description: 'Открыть поиск',
    },
    {
      key: 'n',
      ctrl: true,
      action: () => {
        // Открыть модальное окно создания (ищем кнопку с текстом "Добавить" или "Новая")
        const buttons = Array.from(document.querySelectorAll('button'))
        const addButton = buttons.find(btn => 
          btn.textContent?.includes('Добавить') || 
          btn.textContent?.includes('Новая') ||
          btn.textContent?.includes('Новый')
        ) as HTMLButtonElement
        if (addButton && !addButton.disabled) {
          addButton.click()
        }
      },
      description: 'Создать новый элемент',
    },
    {
      key: '/',
      action: () => {
        const searchInput = document.querySelector('input[type="text"][placeholder*="Поиск"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
        }
      },
      description: 'Фокус на поиск',
    },
    {
      key: 'Escape',
      action: () => {
        // Закрыть модальные окна
        const modal = document.querySelector('[role="dialog"]') as HTMLElement
        if (modal) {
          const closeButton = modal.querySelector('button[aria-label="Закрыть"], button:has-text("Отмена")') as HTMLButtonElement
          if (closeButton) {
            closeButton.click()
          }
        }
      },
      description: 'Закрыть модальное окно',
    },
  ])
}

