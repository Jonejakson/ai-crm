'use client'

import { useEffect, useState } from 'react'
import { CopyIcon, SuccessIcon, ErrorIcon } from '@/components/Icons'

interface WebhookIntegration {
  id: number
  name: string
  token: string
  description: string | null
  isActive: boolean
  autoCreateContact: boolean
  autoCreateDeal: boolean
  defaultAssignee?: { id: number; name: string; email: string } | null
  defaultSource?: { id: number; name: string } | null
  defaultPipeline?: { id: number; name: string } | null
  _count?: { logs: number }
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

export default function WebhookIntegrationsSection() {
  const [webhooks, setWebhooks] = useState<WebhookIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [sources, setSources] = useState<DealSource[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedTokenId, setCopiedTokenId] = useState<number | null>(null)
  const [origin, setOrigin] = useState('')

  const [formState, setFormState] = useState({
    name: '',
    description: '',
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
      const [webhooksRes, sourcesRes, pipelinesRes, usersRes] = await Promise.all([
        fetch('/api/webhooks'),
        fetch('/api/deal-sources'),
        fetch('/api/pipelines'),
        fetch('/api/admin/users'),
      ])

      if (webhooksRes.ok) {
        const data = (await webhooksRes.json()) as WebhookIntegration[]
        setWebhooks(Array.isArray(data) ? data : [])
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
      console.error('[webhook-integrations][fetchInitialData]', fetchError)
      setError('Не удалось загрузить интеграции. Попробуйте обновить страницу.')
    } finally {
      setLoading(false)
    }
  }

  function openCreateModal() {
    setEditingId(null)
    setFormState({
      name: '',
      description: '',
      isActive: true,
      autoCreateContact: true,
      autoCreateDeal: false,
      defaultSourceId: '',
      defaultPipelineId: '',
      defaultAssigneeId: '',
    })
    setModalOpen(true)
  }

  function openEditModal(webhook: WebhookIntegration) {
    setEditingId(webhook.id)
    setFormState({
      name: webhook.name,
      description: webhook.description || '',
      isActive: webhook.isActive,
      autoCreateContact: webhook.autoCreateContact,
      autoCreateDeal: webhook.autoCreateDeal,
      defaultSourceId: webhook.defaultSource?.id ? String(webhook.defaultSource.id) : '',
      defaultPipelineId: webhook.defaultPipeline?.id ? String(webhook.defaultPipeline.id) : '',
      defaultAssigneeId: webhook.defaultAssignee?.id ? String(webhook.defaultAssignee.id) : '',
    })
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formState.name.trim()) {
      setError('Название обязательно')
      return
    }

    setProcessing(true)
    setError(null)

    const payload: any = {
      name: formState.name.trim(),
      description: formState.description.trim() || null,
      isActive: formState.isActive,
      autoCreateContact: formState.autoCreateContact,
      autoCreateDeal: formState.autoCreateDeal,
      defaultSourceId: formState.defaultSourceId ? Number(formState.defaultSourceId) : null,
      defaultPipelineId: formState.defaultPipelineId ? Number(formState.defaultPipelineId) : null,
      defaultAssigneeId: formState.defaultAssigneeId ? Number(formState.defaultAssigneeId) : null,
    }

    try {
      const endpoint = editingId ? `/api/webhooks/${editingId}` : '/api/webhooks'
      const method = editingId ? 'PUT' : 'POST'
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || 'Не удалось сохранить интеграцию')
      }

      setModalOpen(false)
      setEditingId(null)
      await fetchInitialData()
    } catch (saveError) {
      console.error('[webhook-integrations][save]', saveError)
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить интеграцию')
    } finally {
      setProcessing(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Удалить интеграцию? Это действие нельзя отменить.')) return
    try {
      const response = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Не удалось удалить интеграцию')
      await fetchInitialData()
    } catch (deleteError) {
      console.error('[webhook-integrations][delete]', deleteError)
      setError('Не удалось удалить интеграцию')
    }
  }

  async function handleToggle(webhook: WebhookIntegration) {
    try {
      const response = await fetch(`/api/webhooks/${webhook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !webhook.isActive }),
      })
      if (!response.ok) throw new Error('Не удалось изменить статус')
      await fetchInitialData()
    } catch (toggleError) {
      console.error('[webhook-integrations][toggle]', toggleError)
      setError('Не удалось изменить статус интеграции')
    }
  }

  async function handleRegenerateToken(id: number) {
    if (!confirm('Регенерировать токен? Старый токен перестанет работать.')) return
    try {
      const response = await fetch(`/api/webhooks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_token' }),
      })
      if (!response.ok) throw new Error('Не удалось регенерировать токен')
      await fetchInitialData()
    } catch (regenerateError) {
      console.error('[webhook-integrations][regenerate]', regenerateError)
      setError('Не удалось регенерировать токен')
    }
  }

  function copyWebhookUrl(token: string, id: number) {
    const url = `${origin}/api/webhooks/incoming/${token}`
    navigator.clipboard.writeText(url)
    setCopiedTokenId(id)
    setTimeout(() => setCopiedTokenId(null), 2000)
  }

  function copyToken(token: string, id: number) {
    navigator.clipboard.writeText(token)
    setCopiedTokenId(id)
    setTimeout(() => setCopiedTokenId(null), 2000)
  }

  return (
    <section className="space-y-4">
      <div className="glass-panel rounded-3xl p-6 space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Webhook интеграции</h2>
            <p className="text-sm text-[var(--muted)]">
              Подключите внешние системы (Zapier, Make.com, n8n и др.) для автоматического создания контактов и сделок.
            </p>
          </div>
          <button onClick={openCreateModal} className="btn-primary text-sm">
            + Создать webhook
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-[var(--muted)]">Загрузка...</div>
        ) : webhooks.length === 0 ? (
          <div className="py-12 text-center text-[var(--muted)]">
            <p className="mb-4">У вас ещё нет webhook интеграций.</p>
            <button onClick={openCreateModal} className="btn-secondary">
              Создать первую интеграцию
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="rounded-2xl border border-[var(--border)] p-5 shadow-sm bg-white/80"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-[var(--foreground)]">
                        {webhook.name}
                      </h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          webhook.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}
                      >
                        {webhook.isActive ? 'Активна' : 'Выключена'}
                      </span>
                    </div>
                    {webhook.description && (
                      <p className="text-sm text-[var(--muted)] mb-2">{webhook.description}</p>
                    )}
                    <div className="space-y-2 text-sm text-[var(--muted)]">
                      <div>
                        <strong>Webhook URL:</strong>{' '}
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                          {origin}/api/webhooks/incoming/{webhook.token.substring(0, 8)}...
                        </code>
                        <button
                          onClick={() => copyWebhookUrl(webhook.token, webhook.id)}
                          className="ml-2 text-[var(--primary)] hover:underline text-xs"
                        >
                          {copiedTokenId === webhook.id ? (
                            <>
                              <SuccessIcon className="w-4 h-4" /> Скопировано
                            </>
                          ) : (
                            <>
                              <CopyIcon className="w-4 h-4" /> Копировать URL
                            </>
                          )}
                        </button>
                      </div>
                      <div>
                        <strong>Токен:</strong>{' '}
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                          {webhook.token.substring(0, 16)}...
                        </code>
                        <button
                          onClick={() => copyToken(webhook.token, webhook.id)}
                          className="ml-2 text-[var(--primary)] hover:underline text-xs"
                        >
                          {copiedTokenId === webhook.id ? (
                            <>
                              <SuccessIcon className="w-4 h-4" /> Скопировано
                            </>
                          ) : (
                            <>
                              <CopyIcon className="w-4 h-4" /> Копировать
                            </>
                          )}
                        </button>
                      </div>
                      <div>
                        Автосоздание контактов: {webhook.autoCreateContact ? <SuccessIcon className="w-4 h-4 inline" /> : <ErrorIcon className="w-4 h-4 inline" />} • 
                        Автосоздание сделок: {webhook.autoCreateDeal ? <SuccessIcon className="w-4 h-4 inline" /> : <ErrorIcon className="w-4 h-4 inline" />}
                      </div>
                      {webhook._count && (
                        <div>
                          Обработано запросов: {webhook._count.logs}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleToggle(webhook)}
                      className="rounded-2xl border border-[var(--border)] px-4 py-2 text-sm"
                    >
                      {webhook.isActive ? 'Выключить' : 'Включить'}
                    </button>
                    <button
                      onClick={() => handleRegenerateToken(webhook.id)}
                      className="rounded-2xl border border-[var(--border)] px-4 py-2 text-sm"
                    >
                      🔄 Регенерировать токен
                    </button>
                    <button
                      onClick={() => openEditModal(webhook)}
                      className="rounded-2xl border border-[var(--border)] px-4 py-2 text-sm"
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={() => handleDelete(webhook.id)}
                      className="rounded-2xl border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-[var(--foreground)]">
                  {editingId ? 'Редактирование webhook' : 'Новый webhook'}
                </h3>
                <p className="text-sm text-[var(--muted)]">
                  Настройте параметры для приема данных из внешних систем
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-2xl text-[var(--muted)]">
                ✕
              </button>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Название *
                </label>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  placeholder="Например: Zapier интеграция"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Описание
                </label>
                <textarea
                  value={formState.description}
                  onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  placeholder="Описание интеграции (необязательно)"
                  rows={3}
                />
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
                <p className="font-semibold text-blue-900 mb-2">📚 Как использовать:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-800">
                  <li>После создания вы получите уникальный URL и токен</li>
                  <li>Используйте этот URL в Zapier, Make.com, n8n или другой системе</li>
                  <li>Отправляйте POST запросы с данными в формате JSON</li>
                  <li>Система автоматически создаст контакты и сделки</li>
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

