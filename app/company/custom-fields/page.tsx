'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import CustomFieldsManager from '@/components/CustomFieldsManager'

export default function CustomFieldsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'contact' | 'deal' | 'task'>('contact')

  if (status === 'loading') {
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
    router.push('/')
    return null
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.push('/company')}
          className="text-blue-600 hover:text-blue-700 mb-4"
        >
          ← Назад к управлению компанией
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Кастомные поля</h1>
        <p className="text-gray-600">
          Создавайте и управляйте дополнительными полями для контактов, сделок и задач
        </p>
      </div>

      {/* Вкладки */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'contact' as const, name: 'Контакты' },
            { id: 'deal' as const, name: 'Сделки' },
            { id: 'task' as const, name: 'Задачи' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Контент */}
      <div className="glass-panel rounded-3xl p-6">
        <CustomFieldsManager entityType={activeTab} />
      </div>
    </div>
  )
}

