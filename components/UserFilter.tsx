'use client'

import { useState, useEffect } from 'react'
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
  const isAdmin = session?.user?.role === 'admin'

  useEffect(() => {
    if (isAdmin) {
      fetchUsers()
    } else {
      setLoading(false)
    }
  }, [isAdmin])

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

  return (
    <div className="mb-4 flex items-center gap-3">
      <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
        Фильтр по менеджеру:
      </label>
      <select
        value={selectedUserId || 'all'}
        onChange={(e) => {
          const value = e.target.value
          onUserChange(value === 'all' ? null : parseInt(value))
        }}
        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 min-w-[200px]"
      >
        <option value="all">Все менеджеры</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} {user.id === currentUserId ? '(Вы)' : ''}
            {user.role === 'admin' ? ' [Админ]' : user.role === 'manager' ? ' [Менеджер]' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

