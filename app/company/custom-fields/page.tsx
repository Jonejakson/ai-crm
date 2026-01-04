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
          <div className="loading-spinner mx-auto mb-4" />
          <p className="text-[var(--muted)]">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (session?.user?.role !== 'admin' && session?.user?.role !== 'owner') {
    router.push('/')
    return null
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="space-y-4">
        <button
          onClick={() => router.push('/company')}
          className="btn-secondary inline-flex items-center gap-2 text-sm"
        >
          ← Назад к управлению компанией
        </button>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Настройки</p>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Кастомные поля</h1>
          <p className="text-sm text-[var(--muted)]">
            Создавайте и управляйте дополнительными полями для контактов, сделок и задач
          </p>
        </div>
      </div>

      {/* Вкладки */}
      <div className="glass-panel rounded-3xl p-4">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'contact' as const, name: 'Контакты' },
            { id: 'deal' as const, name: 'Сделки' },
            { id: 'task' as const, name: 'Задачи' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-lg'
                  : 'bg-white/80 text-[var(--muted)] border border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {/* Контент */}
      <div className="glass-panel rounded-3xl p-6">
        <CustomFieldsManager entityType={activeTab} />
      </div>
    </div>
  )
}

