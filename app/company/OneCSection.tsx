'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface OneCIntegration {
  id: number
  platform: string
  name: string | null
  isActive: boolean
  baseUrl: string | null
  apiToken: string | null
  apiSecret: string | null
  accountId: string | null
  syncContacts: boolean
  syncDeals: boolean
  syncProducts: boolean
  autoSync: boolean
  syncInterval: number
  lastSyncAt: string | null
}

export default function OneCSection() {
  const [integration, setIntegration] = useState<OneCIntegration | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [authMethod, setAuthMethod] = useState<'token' | 'login'>('token')
  const [formData, setFormData] = useState({
    name: '',
    baseUrl: '',
    apiToken: '',
    login: '',
    password: '',
    accountId: '',
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
      const response = await fetch('/api/accounting/one-c')
      if (response.ok) {
        const data = await response.json()
        if (data) {
          setIntegration(data)
          // Определяем метод авторизации
          if (data.apiToken && !data.apiSecret) {
            setAuthMethod('token')
          } else {
            setAuthMethod('login')
          }
          setFormData({
            name: data.name || '',
            baseUrl: data.baseUrl || '',
            apiToken: data.apiToken || '',
            login: (data.settings as any)?.login || '',
            password: '', // Не показываем сохраненный пароль
            accountId: data.accountId || '',
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
      console.error('Error fetching 1C integration:', error)
      toast.error('Ошибка загрузки настроек 1С')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const submitData = {
        ...formData,
        // Если используется токен, отправляем только токен
        // Если логин/пароль, отправляем оба
        apiToken: authMethod === 'token' ? formData.apiToken : undefined,
        apiSecret: authMethod === 'login' ? formData.password : undefined,
        login: authMethod === 'login' ? formData.login : undefined,
        settings: authMethod === 'login' ? { login: formData.login } : null,
      }

      const response = await fetch('/api/accounting/one-c', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      })

      if (response.ok) {
        const data = await response.json()
        setIntegration(data)
        toast.success('Настройки 1С сохранены')
        fetchIntegration()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка сохранения настроек')
      }
    } catch (error) {
      console.error('Error saving 1C integration:', error)
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
        <h3 className="text-lg font-semibold mb-2">1С:Предприятие</h3>
        <p className="text-sm text-[var(--muted)]">
          Выгружайте контакты и заказы из CRM в 1С. Для работы интеграции в 1С должен быть настроен веб-сервис или REST API.
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
            placeholder="1С интеграция"
            className="w-full"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            URL базы 1С *
          </label>
          <input
            type="url"
            value={formData.baseUrl}
            onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
            placeholder="http://server:port/base или https://1c.example.com/base"
            required
            className="w-full"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            URL базы данных 1С. Например: http://192.168.1.100:8080/base или https://1c.company.com/base
          </p>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Метод авторизации
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="authMethod"
                value="token"
                checked={authMethod === 'token'}
                onChange={() => setAuthMethod('token')}
                className="w-4 h-4"
              />
              <span className="text-sm">API Токен</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="authMethod"
                value="login"
                checked={authMethod === 'login'}
                onChange={() => setAuthMethod('login')}
                className="w-4 h-4"
              />
              <span className="text-sm">Логин / Пароль</span>
            </label>
          </div>
        </div>

        {authMethod === 'token' ? (
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              API Токен *
            </label>
            <input
              type="password"
              value={formData.apiToken}
              onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
              placeholder={integration ? "Оставьте пустым, чтобы не менять" : "Введите API токен"}
              required={!integration}
              className="w-full"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              API токен для доступа к 1С (если используется Bearer авторизация)
            </p>
          </div>
        ) : (
          <>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Логин *
              </label>
              <input
                type="text"
                value={formData.login}
                onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                placeholder="Логин для входа в 1С"
                required
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Пароль *
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={integration ? "Оставьте пустым, чтобы не менять" : "Пароль для входа в 1С"}
                required={!integration}
                className="w-full"
              />
            </div>
          </>
        )}

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            ID организации (опционально)
          </label>
          <input
            type="text"
            value={formData.accountId}
            onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
            placeholder="Идентификатор организации в 1С"
            className="w-full"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Если в 1С несколько организаций, укажите ID нужной организации
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
            <li>Настройте веб-сервис или REST API в 1С (если еще не настроен)</li>
            <li>Укажите URL базы 1С и учетные данные выше</li>
            <li>Откройте любую сделку в CRM</li>
            <li>Нажмите кнопку "Выгрузить в 1С" (будет добавлена на страницу сделки)</li>
            <li>В 1С будет создан контрагент (если его еще нет) и документ продажи</li>
          </ol>
          <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs">
            <strong>Важно:</strong> Формат API может отличаться в зависимости от конфигурации 1С. 
            Если выгрузка не работает, проверьте формат данных в настройках веб-сервиса 1С.
          </div>
        </div>
      )}
    </div>
  )
}

