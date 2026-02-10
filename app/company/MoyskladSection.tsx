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
  settings?: any
}

type CompanyUser = { id: number; name: string; email: string; role: string }
type MoyskladEmployee = { id: string; name: string; email: string | null; archived: boolean }

function getInitialUserIdToEmployeeId(integration: MoyskladIntegration | null): Record<string, string> {
  const settings = (integration?.settings as any) || {}
  const raw = settings.userIdToEmployeeId
  return raw && typeof raw === 'object' ? raw : {}
}

export default function MoyskladSection() {
  const [integration, setIntegration] = useState<MoyskladIntegration | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [importOrderId, setImportOrderId] = useState('')
  const [importing, setImporting] = useState(false)
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [employees, setEmployees] = useState<MoyskladEmployee[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
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

  useEffect(() => {
    if (!integration) return
    setMapping(getInitialUserIdToEmployeeId(integration))
    fetchUsers()
    fetchEmployees()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integration?.id])

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

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (!response.ok) return
      const data = await response.json()
      const list = Array.isArray(data?.users) ? data.users : []
      setUsers(
        list.map((u: any) => ({
          id: Number(u.id),
          name: String(u.name || u.email || ''),
          email: String(u.email || ''),
          role: String(u.role || ''),
        }))
      )
    } catch (e) {
      console.error('Error fetching company users:', e)
    }
  }

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/accounting/moysklad/employees')
      if (!response.ok) return
      const data = await response.json()
      const list = Array.isArray(data) ? data : []
      setEmployees(
        list
          .map((e: any) => ({
            id: String(e.id),
            name: String(e.name || ''),
            email: e.email ? String(e.email) : null,
            archived: Boolean(e.archived),
          }))
          .sort((a: MoyskladEmployee, b: MoyskladEmployee) => {
            if (a.archived !== b.archived) return a.archived ? 1 : -1
            return a.name.localeCompare(b.name, 'ru')
          })
      )
    } catch (e) {
      console.error('Error fetching Moysklad employees:', e)
    }
  }

  const handleImportFromMoysklad = async () => {
    const orderId = importOrderId.trim()
    if (!orderId) {
      toast.error('Введите ID заказа из МойСклад')
      return
    }
    setImporting(true)
    try {
      const response = await fetch('/api/accounting/moysklad/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const data = await response.json()
      if (response.ok) {
        toast.success(data.message || 'Контакт и сделка созданы')
        setImportOrderId('')
        if (data.dealId) {
          window.location.href = `/deals/${data.dealId}`
        }
      } else {
        toast.error(data.error || 'Ошибка импорта')
      }
    } catch (e) {
      console.error('Import from Moysklad', e)
      toast.error('Ошибка импорта')
    } finally {
      setImporting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch('/api/accounting/moysklad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          settings: {
            ...(integration?.settings || {}),
            userIdToEmployeeId: mapping,
          },
        }),
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
          Двусторонняя синхронизация: импортируйте заказы из МойСклад в CRM (контакт + сделка) или выгружайте сделки из CRM в МойСклад.
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

        </div>

        <div className="border-t pt-4 space-y-3">
          <h4 className="text-sm font-semibold">Владелец/ответственный в МойСклад (по менеджерам)</h4>
          <p className="text-sm text-[var(--muted)]">
            CRM использует один доступ (админ), но при выгрузке проставляет владельца заказа/контрагента как сотрудника МойСклад.
            Тогда менеджер видит только свои документы (если права в МойСклад ограничены по владельцу).
          </p>

          {users.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Пользователи компании не загружены.</p>
          ) : employees.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Сотрудники МойСклад не загружены (проверь учётные данные и доступ к API).
            </p>
          ) : (
            <div className="space-y-2">
              {users
                .filter((u) => u.role !== 'owner')
                .map((u) => (
                  <div key={u.id} className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
                    <div className="text-sm">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-[var(--muted)]">{u.email}</div>
                    </div>
                    <select
                      className="w-full"
                      value={mapping[String(u.id)] || ''}
                      onChange={(e) => {
                        const value = e.target.value
                        setMapping((prev) => {
                          const next = { ...prev }
                          if (!value) delete next[String(u.id)]
                          else next[String(u.id)] = value
                          return next
                        })
                      }}
                    >
                      <option value="">— Не назначать владельца —</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.archived ? '[архив] ' : ''}
                          {emp.name}
                          {emp.email ? ` (${emp.email})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
            </div>
          )}
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
        <>
          <div className="mt-6 p-4 bg-[var(--background-soft)] rounded-lg border-t">
            <h4 className="text-sm font-semibold mb-2">Импорт из МойСклад</h4>
            <p className="text-sm text-[var(--muted)] mb-3">
              Есть заказ и клиент в МойСклад? Введите ID заказа — в CRM создадутся контакт и сделка.
            </p>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                value={importOrderId}
                onChange={(e) => setImportOrderId(e.target.value)}
                placeholder="ID заказа (например: 7944e4fd-3a81-11ea-8a5b-...)"
                className="flex-1 min-w-[200px] rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleImportFromMoysklad}
                disabled={importing}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {importing ? 'Импорт...' : 'Импортировать'}
              </button>
            </div>
            <p className="text-xs text-[var(--muted)] mt-2">
              ID заказа можно скопировать из URL в МойСклад: app.moysklad.ru/app/#customerorder/edit?id=...
            </p>
          </div>
          <div className="mt-4 p-4 bg-[var(--background-soft)] rounded-lg">
            <h4 className="text-sm font-semibold mb-2">Как использовать:</h4>
            <ol className="text-sm text-[var(--muted)] space-y-1 list-decimal list-inside">
              <li>Настройте интеграцию выше</li>
              <li>Импорт: введите ID заказа из МойСклад — создастся контакт и сделка</li>
              <li>Выгрузка: откройте сделку в CRM и нажмите «Выгрузить в МойСклад»</li>
              <li>В МойСклад добавьте позиции к заказу вручную при необходимости</li>
            </ol>
          </div>
        </>
      )}
    </div>
  )
}

