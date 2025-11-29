'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface MoyskladIntegration {
  id: number
  platform: string
  name: string | null
  isActive: boolean
  apiToken: string | null
  apiSecret: string | null
  syncContacts: boolean
  syncDeals: boolean
  syncProducts: boolean
  autoSync: boolean
  syncInterval: number
  lastSyncAt: string | null
}

export default function MoyskladSection() {
  const [integration, setIntegration] = useState<MoyskladIntegration | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    login: '',
    password: '',
    isActive: true,
    syncContacts: true,
    syncDeals: true,
    syncProducts: false,
    autoSync: false,
    syncInterval: 60,
  })

  useEffect(() => {
    fetchIntegration()
  }, [])

  const fetchIntegration = async () => {
    try {
      const response = await fetch('/api/accounting/moysklad')
      if (response.ok) {
        const data = await response.json()
        if (data) {
          setIntegration(data)
          setFormData({
            name: data.name || '',
            login: data.apiToken || '',
            password: '', // Не показываем сохраненный пароль
            isActive: data.isActive,
            syncContacts: data.syncContacts,
            syncDeals: data.syncDeals,
            syncProducts: data.syncProducts,
            autoSync: data.autoSync,
            syncInterval: data.syncInterval || 60,
          })
        }
      }
    } catch (error) {
      console.error('Error fetching Moysklad integration:', error)
      toast.error('Ошибка загрузки настроек МойСклад')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch('/api/accounting/moysklad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const data = await response.json()
        setIntegration(data)
        toast.success('Настройки МойСклад сохранены')
        fetchIntegration()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка сохранения настроек')
      }
    } catch (error) {
      console.error('Error saving Moysklad integration:', error)
      toast.error('Ошибка сохранения настроек')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">МойСклад</h3>
        <p className="text-sm text-[var(--muted)]">
          Выгружайте контакты и заказы из CRM в МойСклад. После настройки используйте кнопку "Выгрузить в МойСклад" на странице сделки.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Название интеграции
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="МойСклад интеграция"
            className="w-full"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Логин (Email) *
          </label>
          <input
            type="email"
            value={formData.login}
            onChange={(e) => setFormData({ ...formData, login: e.target.value })}
            placeholder="your-email@example.com"
            required
            className="w-full"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Email для входа в МойСклад
          </p>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Пароль / API ключ *
          </label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder={integration ? "Оставьте пустым, чтобы не менять" : "Введите пароль или API ключ"}
            required={!integration}
            className="w-full"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Пароль от аккаунта МойСклад или API ключ (можно получить в настройках МойСклад)
          </p>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm">Активна</span>
          </label>
        </div>

        <div className="border-t pt-4 space-y-3">
          <h4 className="text-sm font-semibold">Настройки синхронизации</h4>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.syncContacts}
              onChange={(e) => setFormData({ ...formData, syncContacts: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm">Синхронизировать контакты</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.syncDeals}
              onChange={(e) => setFormData({ ...formData, syncDeals: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm">Синхронизировать сделки (заказы)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.syncProducts}
              onChange={(e) => setFormData({ ...formData, syncProducts: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm">Синхронизировать товары (в разработке)</span>
          </label>
        </div>

        {integration && integration.lastSyncAt && (
          <div className="text-xs text-[var(--muted)]">
            Последняя синхронизация: {new Date(integration.lastSyncAt).toLocaleString('ru-RU')}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'Сохранение...' : integration ? 'Обновить настройки' : 'Сохранить'}
          </button>
        </div>
      </form>

      {integration && (
        <div className="mt-6 p-4 bg-[var(--background-soft)] rounded-lg">
          <h4 className="text-sm font-semibold mb-2">Как использовать:</h4>
          <ol className="text-sm text-[var(--muted)] space-y-1 list-decimal list-inside">
            <li>Настройте интеграцию выше</li>
            <li>Откройте любую сделку в CRM</li>
            <li>Нажмите кнопку "Выгрузить в МойСклад"</li>
            <li>В МойСклад будет создан контрагент (если его еще нет) и заказ</li>
            <li>В МойСклад добавьте позиции к заказу вручную</li>
          </ol>
        </div>
      )}
    </div>
  )
}

