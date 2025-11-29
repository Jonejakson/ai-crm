'use client'

import { useEffect, useState } from 'react'

interface WhatsAppIntegration {
  id: number
  platform: 'WHATSAPP'
  isActive: boolean
  botToken: string | null
  webhookUrl: string | null
  webhookSecret: string | null
  settings: any
  autoCreateContact: boolean
  autoCreateDeal: boolean
  defaultAssignee?: { id: number; name: string; email: string } | null
  defaultSource?: { id: number; name: string } | null
  defaultPipeline?: { id: number; name: string } | null
  createdAt: string
}

interface DealSource {
  id: number
  name: string
}

interface Pipeline {
  id: number
  name: string
}

interface CompanyUser {
  id: number
  name: string
  email: string
}

export default function WhatsAppSection() {
  const [integration, setIntegration] = useState<WhatsAppIntegration | null>(null)
  const [loading, setLoading] = useState(true)
  const [sources, setSources] = useState<DealSource[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')

  const [formState, setFormState] = useState({
    apiKey: '',
    phoneNumberId: '',
    businessAccountId: '',
    webhookVerifyToken: '',
    apiVersion: 'v18.0',
    isActive: true,
    autoCreateContact: true,
    autoCreateDeal: false,
    defaultSourceId: '',
    defaultPipelineId: '',
    defaultAssigneeId: '',
  })

  useEffect(() => {
    setOrigin(window.location.origin)
    fetchInitialData()
  }, [])

  async function fetchInitialData() {
    try {
      setLoading(true)
      const [integrationRes, sourcesRes, pipelinesRes, usersRes] = await Promise.all([
        fetch('/api/messaging/whatsapp'),
        fetch('/api/deal-sources'),
        fetch('/api/pipelines'),
        fetch('/api/admin/users'),
      ])

      if (integrationRes.ok) {
        const data = (await integrationRes.json()) as WhatsAppIntegration | null
        setIntegration(data)
        if (data) {
          setFormState({
            apiKey: data.botToken || '',
            phoneNumberId: data.settings?.phoneNumberId || '',
            businessAccountId: data.settings?.businessAccountId || '',
            webhookVerifyToken: data.webhookSecret || '',
            apiVersion: data.settings?.apiVersion || 'v18.0',
            isActive: data.isActive,
            autoCreateContact: data.autoCreateContact,
            autoCreateDeal: data.autoCreateDeal,
            defaultSourceId: data.defaultSource?.id ? String(data.defaultSource.id) : '',
            defaultPipelineId: data.defaultPipeline?.id ? String(data.defaultPipeline.id) : '',
            defaultAssigneeId: data.defaultAssignee?.id ? String(data.defaultAssignee.id) : '',
          })
        }
      }
      if (sourcesRes.ok) {
        const data = (await sourcesRes.json()) as DealSource[]
        setSources(Array.isArray(data) ? data : [])
      }
      if (pipelinesRes.ok) {
        const data = (await pipelinesRes.json()) as Pipeline[]
        setPipelines(Array.isArray(data) ? data : [])
      }
      if (usersRes.ok) {
        const data = (await usersRes.json()) as { users?: CompanyUser[] }
        setUsers(Array.isArray(data?.users) ? data.users : [])
      }
    } catch (fetchError) {
      console.error('[whatsapp][fetchInitialData]', fetchError)
      setError('Не удалось загрузить настройки. Попробуйте обновить страницу.')
    } finally {
      setLoading(false)
    }
  }

  function openCreateModal() {
    setFormState({
      apiKey: '',
      phoneNumberId: '',
      businessAccountId: '',
      webhookVerifyToken: '',
      apiVersion: 'v18.0',
      isActive: true,
      autoCreateContact: true,
      autoCreateDeal: false,
      defaultSourceId: '',
      defaultPipelineId: '',
      defaultAssigneeId: '',
    })
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formState.apiKey.trim()) {
      setError('API Key обязателен')
      return
    }
    if (!formState.phoneNumberId.trim()) {
      setError('Phone Number ID обязателен')
      return
    }

    setProcessing(true)
    setError(null)

    const payload: any = {
      apiKey: formState.apiKey.trim(),
      phoneNumberId: formState.phoneNumberId.trim(),
      businessAccountId: formState.businessAccountId.trim() || null,
      webhookVerifyToken: formState.webhookVerifyToken.trim() || null,
      apiVersion: formState.apiVersion,
      isActive: formState.isActive,
      autoCreateContact: formState.autoCreateContact,
      autoCreateDeal: formState.autoCreateDeal,
      defaultSourceId: formState.defaultSourceId ? Number(formState.defaultSourceId) : null,
      defaultPipelineId: formState.defaultPipelineId ? Number(formState.defaultPipelineId) : null,
      defaultAssigneeId: formState.defaultAssigneeId ? Number(formState.defaultAssigneeId) : null,
    }

    try {
      const response = await fetch('/api/messaging/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || 'Не удалось сохранить настройки')
      }

      const savedIntegration = await response.json()
      setIntegration(savedIntegration)
      setModalOpen(false)
      await fetchInitialData()
    } catch (saveError) {
      console.error('[whatsapp][save]', saveError)
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить настройки')
    } finally {
      setProcessing(false)
    }
  }

  async function handleToggle() {
    if (!integration) return

    try {
      const response = await fetch('/api/messaging/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: integration.botToken,
          phoneNumberId: integration.settings?.phoneNumberId || '',
          businessAccountId: integration.settings?.businessAccountId || '',
          webhookVerifyToken: integration.webhookSecret || '',
          apiVersion: integration.settings?.apiVersion || 'v18.0',
          isActive: !integration.isActive,
          autoCreateContact: integration.autoCreateContact,
          autoCreateDeal: integration.autoCreateDeal,
          defaultSourceId: integration.defaultSource?.id || null,
          defaultPipelineId: integration.defaultPipeline?.id || null,
          defaultAssigneeId: integration.defaultAssignee?.id || null,
        }),
      })
      if (!response.ok) throw new Error('Не удалось изменить статус')
      await fetchInitialData()
    } catch (toggleError) {
      console.error('[whatsapp][toggle]', toggleError)
      setError('Не удалось изменить статус')
    }
  }

  return (
    <section className="space-y-4">
      <div className="glass-panel rounded-3xl p-6 space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">WhatsApp Business API</h2>
            <p className="text-sm text-[var(--muted)]">
              Подключите WhatsApp Business API для автоматического получения заявок от клиентов.
            </p>
          </div>
          {!integration && (
            <button onClick={openCreateModal} className="btn-primary text-sm">
              + Подключить WhatsApp
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-[var(--muted)]">Загрузка...</div>
        ) : !integration ? (
          <div className="py-12 text-center text-[var(--muted)]">
            <p className="mb-4">WhatsApp Business API не настроен.</p>
            <button onClick={openCreateModal} className="btn-secondary">
              Подключить WhatsApp
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] p-5 shadow-sm bg-white/80">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">
                      WhatsApp Business API
                    </h3>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        integration.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-gray-100 text-gray-500 border border-gray-200'
                      }`}
                    >
                      {integration.isActive ? 'Активен' : 'Выключен'}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-[var(--muted)]">
                    <div>
                      Webhook URL: <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                        {origin}/api/messaging/whatsapp/webhook
                      </code>
                    </div>
                    <div>
                      Phone Number ID: <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                        {integration.settings?.phoneNumberId || 'Не указан'}
                      </code>
                    </div>
                    <div>
                      Автосоздание контактов: {integration.autoCreateContact ? '✓' : '✗'} • 
                      Автосоздание сделок: {integration.autoCreateDeal ? '✓' : '✗'}
                    </div>
                    {integration.defaultSource && (
                      <div>Источник: {integration.defaultSource.name}</div>
                    )}
                    {integration.defaultPipeline && (
                      <div>Воронка: {integration.defaultPipeline.name}</div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleToggle}
                    className="rounded-2xl border border-[var(--border)] px-4 py-2 text-sm"
                  >
                    {integration.isActive ? 'Выключить' : 'Включить'}
                  </button>
                  <button
                    onClick={openCreateModal}
                    className="rounded-2xl border border-[var(--border)] px-4 py-2 text-sm"
                  >
                    Редактировать
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-[var(--foreground)]">
                  Настройка WhatsApp Business API
                </h3>
                <p className="text-sm text-[var(--muted)]">
                  Получите данные в Meta Business Suite
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-2xl text-[var(--muted)]">
                ✕
              </button>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Access Token (API Key) *
                </label>
                <input
                  type="text"
                  value={formState.apiKey}
                  onChange={(e) => setFormState((prev) => ({ ...prev, apiKey: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  placeholder="EAAxxxxxxxxxxxxx"
                  required
                />
                <p className="text-xs text-[var(--muted)] mt-1">
                  Получите в Meta Business Suite → WhatsApp → API Setup
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Phone Number ID *
                </label>
                <input
                  type="text"
                  value={formState.phoneNumberId}
                  onChange={(e) => setFormState((prev) => ({ ...prev, phoneNumberId: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  placeholder="123456789012345"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Business Account ID (опционально)
                </label>
                <input
                  type="text"
                  value={formState.businessAccountId}
                  onChange={(e) => setFormState((prev) => ({ ...prev, businessAccountId: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  placeholder="123456789012345"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Webhook Verify Token *
                </label>
                <input
                  type="text"
                  value={formState.webhookVerifyToken}
                  onChange={(e) => setFormState((prev) => ({ ...prev, webhookVerifyToken: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  placeholder="your_verify_token"
                  required
                />
                <p className="text-xs text-[var(--muted)] mt-1">
                  Используйте этот токен при настройке webhook в Meta Business Suite
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  API Version
                </label>
                <select
                  value={formState.apiVersion}
                  onChange={(e) => setFormState((prev) => ({ ...prev, apiVersion: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                >
                  <option value="v18.0">v18.0</option>
                  <option value="v19.0">v19.0</option>
                  <option value="v20.0">v20.0</option>
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Источник сделки
                  </label>
                  <select
                    value={formState.defaultSourceId}
                    onChange={(e) => setFormState((prev) => ({ ...prev, defaultSourceId: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  >
                    <option value="">Не указан</option>
                    {sources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Воронка
                  </label>
                  <select
                    value={formState.defaultPipelineId}
                    onChange={(e) => setFormState((prev) => ({ ...prev, defaultPipelineId: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  >
                    <option value="">Не указана</option>
                    {pipelines.map((pipeline) => (
                      <option key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Ответственный
                  </label>
                  <select
                    value={formState.defaultAssigneeId}
                    onChange={(e) => setFormState((prev) => ({ ...prev, defaultAssigneeId: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  >
                    <option value="">Выбрать автоматически</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formState.autoCreateContact}
                  onChange={(e) => setFormState((prev) => ({ ...prev, autoCreateContact: e.target.checked }))}
                />
                <span className="text-sm text-[var(--muted)]">Автоматически создавать контакты</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formState.autoCreateDeal}
                  onChange={(e) => setFormState((prev) => ({ ...prev, autoCreateDeal: e.target.checked }))}
                />
                <span className="text-sm text-[var(--muted)]">Автоматически создавать сделки</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formState.isActive}
                  onChange={(e) => setFormState((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
                <span className="text-sm text-[var(--muted)]">Интеграция активна</span>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm">
                <p className="font-semibold text-blue-900 mb-2">📚 Как настроить:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-800">
                  <li>Создайте приложение в Meta for Developers</li>
                  <li>Добавьте продукт "WhatsApp"</li>
                  <li>Получите Access Token и Phone Number ID</li>
                  <li>Настройте webhook: URL = {origin}/api/messaging/whatsapp/webhook</li>
                  <li>Используйте Webhook Verify Token из формы выше</li>
                  <li>Подпишитесь на события: messages</li>
                </ol>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-2xl border border-[var(--border)] px-4 py-2 text-sm"
                  disabled={processing}
                >
                  Отмена
                </button>
                <button type="submit" className="btn-primary" disabled={processing}>
                  {processing ? 'Сохранение…' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

