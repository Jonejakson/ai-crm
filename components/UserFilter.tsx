'use client'

import { useState, useEffect, useRef } from 'react'
import { UsersGroupIcon } from './Icons'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'

interface User {
  id: number
  name: string
  email: string
  role: string
}

interface UserFilterProps {
  selectedUserId: number | null
  onUserChange: (userId: number | null) => void
}

export default function UserFilter({ selectedUserId, onUserChange }: UserFilterProps) {
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const isAdmin = session?.user?.role === 'admin'

  useEffect(() => {
    if (isAdmin) {
      fetchUsers()
    } else {
      setLoading(false)
    }
  }, [isAdmin])

  // Вычисляем позицию выпадающего меню
  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width
      })
    }
  }

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      updatePosition()
      
      const handleResize = () => updatePosition()
      const handleScroll = () => updatePosition()
      
      window.addEventListener('resize', handleResize)
      window.addEventListener('scroll', handleScroll, true)
      
      return () => {
        window.removeEventListener('resize', handleResize)
        window.removeEventListener('scroll', handleScroll, true)
      }
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      // Небольшая задержка, чтобы не закрыть сразу после открытия
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 0)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  // Если не админ, не показываем фильтр
  if (!isAdmin || loading) {
    return null
  }

  const currentUserId = session?.user?.id ? parseInt(session.user.id) : null
  const selectedUser = selectedUserId ? users.find(u => u.id === selectedUserId) : null
  const displayText = selectedUser 
    ? `${selectedUser.name}${selectedUser.id === currentUserId ? ' (Вы)' : ''}${selectedUser.role === 'admin' ? ' [Админ]' : selectedUser.role === 'manager' ? ' [Менеджер]' : ''}`
    : 'Все менеджеры'

  const handleSelect = (userId: number | null) => {
    onUserChange(userId)
    setIsOpen(false)
  }

  const handleToggle = () => {
    if (!isOpen) {
      updatePosition()
    }
    setIsOpen(!isOpen)
  }

  const dropdownContent = isOpen && (
    <div
      ref={dropdownRef}
      className="fixed rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-lg p-2 space-y-1 z-[9999] max-h-64 overflow-y-auto"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`
      }}
    >
      <button
        onClick={() => handleSelect(null)}
        className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
          !selectedUserId
            ? 'bg-[var(--primary-soft)] text-[var(--primary)] font-semibold'
            : 'hover:bg-[var(--background-soft)] text-[var(--foreground)]'
        }`}
      >
        <div className="flex items-center gap-2">
          <UsersGroupIcon className="w-4 h-4" />
          <span>Все менеджеры</span>
        </div>
      </button>
      {users.map((user) => {
        const isSelected = selectedUserId === user.id
        const isCurrentUser = user.id === currentUserId
        return (
          <button
            key={user.id}
            onClick={() => handleSelect(user.id)}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
              isSelected
                ? 'bg-[var(--primary-soft)] text-[var(--primary)] font-semibold'
                : 'hover:bg-[var(--background-soft)] text-[var(--foreground)]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>👤</span>
              <div className="flex-1 min-w-0">
                <div className="truncate">
                  {user.name}
                  {isCurrentUser && <span className="text-[var(--primary)]"> (Вы)</span>}
                </div>
                <div className="text-xs text-[var(--muted)] mt-0.5">
                  {user.role === 'admin' ? '[Админ]' : user.role === 'manager' ? '[Менеджер]' : ''}
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )

  return (
    <>
      <div className="mb-4 flex flex-col md:flex-row md:items-center gap-3">
        <label className="text-sm font-medium text-[var(--foreground-soft)] md:whitespace-nowrap">
          Фильтр по менеджеру:
        </label>
        <div className="relative w-full md:w-auto">
          <button
            ref={buttonRef}
            onClick={handleToggle}
            className="btn-secondary text-sm flex items-center gap-2 w-full md:min-w-[250px] justify-between"
          >
            <span className="flex items-center gap-2">
              <span>👤</span>
              <span className="truncate">{displayText}</span>
            </span>
            <span className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
        </div>
      </div>
      {typeof window !== 'undefined' && createPortal(dropdownContent, document.body)}
    </>
  )
}

