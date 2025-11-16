'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface User {
  id: number
  email: string
  name: string
  role: string
  createdAt: string
  stats: {
    contacts: number
    tasks: number
    deals: number
    events: number
  }
}

export default function CompanyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Форма создания пользователя
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'manager' as 'user' | 'manager' | 'admin'
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated') {
      // Проверяем, что пользователь админ
      if (session?.user?.role !== 'admin') {
        router.push('/')
        return
      }
      fetchUsers()
    }
  }, [status, session, router])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (!response.ok) {
        if (response.status === 403) {
          router.push('/')
          return
        }
        throw new Error('Ошибка загрузки пользователей')
      }
      const data = await response.json()
      setUsers(data.users || [])
    } catch (error: any) {
      console.error('Error fetching users:', error)
      setError('Ошибка загрузки пользователей')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setCreating(true)

    try {
      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка создания пользователя')
      }

      setSuccess(`Пользователь ${data.user.name} успешно создан!`)
      setFormData({
        email: '',
        password: '',
        name: '',
        role: 'manager'
      })
      
      // Обновляем список пользователей
      await fetchUsers()
    } catch (error: any) {
      console.error('Error creating user:', error)
      setError(error.message || 'Ошибка создания пользователя')
    } finally {
      setCreating(false)
    }
  }

  const getRoleBadge = (role: string) => {
    const badges = {
      admin: 'bg-red-100 text-red-800 border-red-200',
      manager: 'bg-blue-100 text-blue-800 border-blue-200',
      user: 'bg-gray-100 text-gray-800 border-gray-200'
    }
    return badges[role as keyof typeof badges] || badges.user
  }

  const getRoleName = (role: string) => {
    const names = {
      admin: 'Администратор',
      manager: 'Менеджер',
      user: 'Пользователь'
    }
    return names[role as keyof typeof names] || role
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (session?.user?.role !== 'admin') {
    return null
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Управление компанией</h1>
        <p className="text-gray-600">Создавайте и управляйте пользователями вашей компании</p>
      </div>

      {/* Сообщения об ошибках и успехе */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Форма создания пользователя */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Создать нового пользователя</h2>
          
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Имя
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Иван Иванов"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email (логин)
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Пароль
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Минимум 6 символов"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Роль
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'user' | 'manager' | 'admin' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="user">Пользователь</option>
                <option value="manager">Менеджер</option>
                <option value="admin">Администратор</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Менеджер видит только свои данные, админ видит всю компанию
              </p>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? 'Создание...' : 'Создать пользователя'}
            </button>
          </form>
        </div>

        {/* Список пользователей */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Пользователи компании ({users.length})
          </h2>

          {users.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Пользователи не найдены</p>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900">{user.name}</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getRoleBadge(user.role)}`}>
                          {getRoleName(user.role)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{user.email}</p>
                      <p className="text-xs text-gray-500">
                        Создан: {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>

                  {/* Статистика пользователя */}
                  <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-4 gap-2 text-xs">
                    <div className="text-center">
                      <div className="font-semibold text-gray-900">{user.stats.contacts}</div>
                      <div className="text-gray-500">Контакты</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-gray-900">{user.stats.tasks}</div>
                      <div className="text-gray-500">Задачи</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-gray-900">{user.stats.deals}</div>
                      <div className="text-gray-500">Сделки</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-gray-900">{user.stats.events}</div>
                      <div className="text-gray-500">События</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

