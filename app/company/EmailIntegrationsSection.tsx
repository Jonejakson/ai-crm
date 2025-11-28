'use client'

import { useEffect, useState } from 'react'

interface EmailIntegration {
  id: number
  provider: 'GMAIL' | 'OUTLOOK' | 'IMAP_SMTP' | 'YANDEX'
  email: string
  displayName: string | null
  isActive: boolean
  isIncomingEnabled: boolean
  isOutgoingEnabled: boolean
  lastSyncAt: string | null
  autoCreateContact: boolean
  autoCreateDeal: boolean
  defaultAssignee?: { id: number; name: string; email: string } | null
  defaultSource?: { id: number; name: string } | null
  defaultPipeline?: { id: number; name: string } | null
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

export default function EmailIntegrationsSection() {
  const [integrations, setIntegrations] = useState<EmailIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [sources, setSources] = useState<DealSource[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<'GMAIL' | 'OUTLOOK' | 'IMAP_SMTP' | 'YANDEX' | null>(null)

  const [formState, setFormState] = useState({
    provider: 'IMAP_SMTP' as 'GMAIL' | 'OUTLOOK' | 'IMAP_SMTP' | 'YANDEX',
    email: '',
    displayName: '',
    isActive: true,
    isIncomingEnabled: true,
    isOutgoingEnabled: true,
    // IMAP/SMTP
    imapHost: '',
    imapPort: 993,
    imapUsername: '',
    imapPassword: '',
    smtpHost: '',
    smtpPort: 465,
    smtpUsername: '',
    smtpPassword: '',
    useSSL: true,
    // Настройки
    syncInterval: 5,
    autoCreateContact: true,
    autoCreateDeal: false,
    defaultSourceId: '',
    defaultPipelineId: '',
    defaultAssigneeId: '',
  })

  useEffect(() => {
    fetchInitialData()
  }, [])

  async function fetchInitialData() {
    try {
      setLoading(true)
      const [integrationsRes, sourcesRes, pipelinesRes, usersRes] = await Promise.all([
        fetch('/api/email-integrations'),
        fetch('/api/deal-sources'),
        fetch('/api/pipelines'),
        fetch('/api/admin/users'),
      ])

      if (integrationsRes.ok) {
        const data = (await integrationsRes.json()) as EmailIntegration[]
        setIntegrations(Array.isArray(data) ? data : [])
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
      console.error('[email-integrations][fetchInitialData]', fetchError)
      setError('Не удалось загрузить интеграции. Попробуйте обновить страницу.')
    } finally {
      setLoading(false)
    }
  }

  function openCreateModal(provider?: 'GMAIL' | 'OUTLOOK' | 'IMAP_SMTP' | 'YANDEX') {
    setEditingId(null)
    setSelectedProvider(provider || null)
    setFormState({
      provider: provider || 'IMAP_SMTP',
      email: '',
      displayName: '',
      isActive: true,
      isIncomingEnabled: true,
      isOutgoingEnabled: true,
      imapHost: '',
      imapPort: 993,
      imapUsername: '',
      imapPassword: '',
      smtpHost: '',
      smtpPort: 465,
      smtpUsername: '',
      smtpPassword: '',
      useSSL: true,
      syncInterval: 5,
      autoCreateContact: true,
      autoCreateDeal: false,
      defaultSourceId: '',
      defaultPipelineId: '',
      defaultAssigneeId: '',
    })
    setModalOpen(true)
  }

  function openEditModal(integration: EmailIntegration) {
    setEditingId(integration.id)
    setSelectedProvider(integration.provider)
    setFormState({
      provider: integration.provider,
      email: integration.email,
      displayName: integration.displayName || '',
      isActive: integration.isActive,
      isIncomingEnabled: integration.isIncomingEnabled,
      isOutgoingEnabled: integration.isOutgoingEnabled,
      imapHost: '',
      imapPort: 993,
      imapUsername: '',
      imapPassword: '',
      smtpHost: '',
      smtpPort: 465,
      smtpUsername: '',
      smtpPassword: '',
      useSSL: true,
      syncInterval: 5,
      autoCreateContact: integration.autoCreateContact,
      autoCreateDeal: integration.autoCreateDeal,
      defaultSourceId: integration.defaultSource?.id ? String(integration.defaultSource.id) : '',
      defaultPipelineId: integration.defaultPipeline?.id ? String(integration.defaultPipeline.id) : '',
      defaultAssigneeId: integration.defaultAssignee?.id ? String(integration.defaultAssignee.id) : '',
    })
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formState.email.trim()) {
      setError('Email обязателен')
      return
    }

    setProcessing(true)
    setError(null)

    const payload: any = {
      provider: formState.provider,
      email: formState.email.trim(),
      displayName: formState.displayName.trim() || null,
      isActive: formState.isActive,
      isIncomingEnabled: formState.isIncomingEnabled,
      isOutgoingEnabled: formState.isOutgoingEnabled,
      syncInterval: formState.syncInterval,
      autoCreateContact: formState.autoCreateContact,
      autoCreateDeal: formState.autoCreateDeal,
      defaultSourceId: formState.defaultSourceId ? Number(formState.defaultSourceId) : null,
      defaultPipelineId: formState.defaultPipelineId ? Number(formState.defaultPipelineId) : null,
      defaultAssigneeId: formState.defaultAssigneeId ? Number(formState.defaultAssigneeId) : null,
    }

    // Для IMAP/SMTP добавляем настройки
    if (formState.provider === 'IMAP_SMTP' || formState.provider === 'YANDEX') {
      payload.imapHost = formState.imapHost || null
      payload.imapPort = formState.imapPort || null
      payload.imapUsername = formState.imapUsername || null
      payload.imapPassword = formState.imapPassword || null
      payload.smtpHost = formState.smtpHost || null
      payload.smtpPort = formState.smtpPort || null
      payload.smtpUsername = formState.smtpUsername || null
      payload.smtpPassword = formState.smtpPassword || null
      payload.useSSL = formState.useSSL
    }

    try {
      const endpoint = editingId ? `/api/email-integrations/${editingId}` : '/api/email-integrations'
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
      console.error('[email-integrations][save]', saveError)
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить интеграцию')
    } finally {
      setProcessing(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Удалить интеграцию? Это действие нельзя отменить.')) return
    try {
      const response = await fetch(`/api/email-integrations/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Не удалось удалить интеграцию')
      await fetchInitialData()
    } catch (deleteError) {
      console.error('[email-integrations][delete]', deleteError)
      setError('Не удалось удалить интеграцию')
    }
  }

  async function handleToggle(integration: EmailIntegration) {
    try {
      const response = await fetch(`/api/email-integrations/${integration.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !integration.isActive }),
      })
      if (!response.ok) throw new Error('Не удалось изменить статус')
      await fetchInitialData()
    } catch (toggleError) {
      console.error('[email-integrations][toggle]', toggleError)
      setError('Не удалось изменить статус интеграции')
    }
  }

  function getProviderName(provider: string) {
    const names: Record<string, string> = {
      GMAIL: 'Gmail',
      OUTLOOK: 'Outlook',
      IMAP_SMTP: 'IMAP/SMTP',
      YANDEX: 'Yandex',
    }
    return names[provider] || provider
  }

  return (
    <section className="space-y-4">
      <div className="glass-panel rounded-3xl p-6 space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Email-интеграции</h2>
            <p className="text-sm text-[var(--muted)]">
              Подключите почтовые ящики для получения и отправки писем из CRM.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => openCreateModal('GMAIL')} className="btn-secondary text-sm">
              + Gmail
            </button>
            <button onClick={() => openCreateModal('OUTLOOK')} className="btn-secondary text-sm">
              + Outlook
            </button>
            <button onClick={() => openCreateModal('IMAP_SMTP')} className="btn-secondary text-sm">
              + IMAP/SMTP
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-[var(--muted)]">Загрузка...</div>
        ) : integrations.length === 0 ? (
          <div className="py-12 text-center text-[var(--muted)]">
            <p className="mb-4">У вас ещё нет email-интеграций.</p>
            <button onClick={() => openCreateModal()} className="btn-secondary">
              Подключить первую интеграцию
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className="rounded-2xl border border-[var(--border)] p-5 shadow-sm bg-white/80"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-[var(--foreground)]">
                        {integration.displayName || integration.email}
                      </h3>
                      <span className="rounded-full px-3 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                        {getProviderName(integration.provider)}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          integration.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}
                      >
                        {integration.isActive ? 'Активна' : 'Выключена'}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--muted)]">
                      {integration.email}
                    </p>
                    <p className="text-sm text-[var(--muted)]">
                      Входящие: {integration.isIncomingEnabled ? '✓' : '✗'} • Исходящие:{' '}
                      {integration.isOutgoingEnabled ? '✓' : '✗'}
                    </p>
                    {integration.lastSyncAt && (
                      <p className="text-xs text-[var(--muted)]">
                        Последняя синхронизация: {new Date(integration.lastSyncAt).toLocaleString('ru-RU')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleToggle(integration)}
                      className="rounded-2xl border border-[var(--border)] px-4 py-2 text-sm"
                    >
                      {integration.isActive ? 'Выключить' : 'Включить'}
                    </button>
                    <button
                      onClick={() => openEditModal(integration)}
                      className="rounded-2xl border border-[var(--border)] px-4 py-2 text-sm"
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={() => handleDelete(integration.id)}
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
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-[var(--foreground)]">
                  {editingId ? 'Редактирование интеграции' : 'Новая email-интеграция'}
                </h3>
                <p className="text-sm text-[var(--muted)]">
                  {selectedProvider === 'GMAIL' || selectedProvider === 'OUTLOOK'
                    ? 'Подключение через OAuth (будет реализовано)'
                    : 'Настройте параметры IMAP/SMTP для подключения'}
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-2xl text-[var(--muted)]">
                ✕
              </button>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Провайдер
                  </label>
                  <select
                    value={formState.provider}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        provider: e.target.value as 'GMAIL' | 'OUTLOOK' | 'IMAP_SMTP' | 'YANDEX',
                      }))
                    }
                    disabled={!!editingId}
                    className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] disabled:bg-gray-100"
                  >
                    <option value="GMAIL">Gmail</option>
                    <option value="OUTLOOK">Outlook</option>
                    <option value="IMAP_SMTP">IMAP/SMTP</option>
                    <option value="YANDEX">Yandex</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formState.email}
                    onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                    required
                  />
                </div>
              </div>

              {(formState.provider === 'IMAP_SMTP' || formState.provider === 'YANDEX') && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        IMAP Host
                      </label>
                      <input
                        type="text"
                        value={formState.imapHost}
                        onChange={(e) => setFormState((prev) => ({ ...prev, imapHost: e.target.value }))}
                        placeholder="imap.example.com"
                        className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        IMAP Port
                      </label>
                      <input
                        type="number"
                        value={formState.imapPort}
                        onChange={(e) => setFormState((prev) => ({ ...prev, imapPort: Number(e.target.value) }))}
                        className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        IMAP Username
                      </label>
                      <input
                        type="text"
                        value={formState.imapUsername}
                        onChange={(e) => setFormState((prev) => ({ ...prev, imapUsername: e.target.value }))}
                        className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        IMAP Password
                      </label>
                      <input
                        type="password"
                        value={formState.imapPassword}
                        onChange={(e) => setFormState((prev) => ({ ...prev, imapPassword: e.target.value }))}
                        className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        SMTP Host
                      </label>
                      <input
                        type="text"
                        value={formState.smtpHost}
                        onChange={(e) => setFormState((prev) => ({ ...prev, smtpHost: e.target.value }))}
                        placeholder="smtp.example.com"
                        className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        SMTP Port
                      </label>
                      <input
                        type="number"
                        value={formState.smtpPort}
                        onChange={(e) => setFormState((prev) => ({ ...prev, smtpPort: Number(e.target.value) }))}
                        className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        SMTP Username
                      </label>
                      <input
                        type="text"
                        value={formState.smtpUsername}
                        onChange={(e) => setFormState((prev) => ({ ...prev, smtpUsername: e.target.value }))}
                        className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        SMTP Password
                      </label>
                      <input
                        type="password"
                        value={formState.smtpPassword}
                        onChange={(e) => setFormState((prev) => ({ ...prev, smtpPassword: e.target.value }))}
                        className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formState.useSSL}
                      onChange={(e) => setFormState((prev) => ({ ...prev, useSSL: e.target.checked }))}
                    />
                    <span className="text-sm text-[var(--muted)]">Использовать SSL</span>
                  </div>
                </>
              )}

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
                <span className="text-sm text-[var(--muted)]">Автоматически создавать контакты из писем</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formState.autoCreateDeal}
                  onChange={(e) => setFormState((prev) => ({ ...prev, autoCreateDeal: e.target.checked }))}
                />
                <span className="text-sm text-[var(--muted)]">Автоматически создавать сделки из писем</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formState.isActive}
                  onChange={(e) => setFormState((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
                <span className="text-sm text-[var(--muted)]">Интеграция активна</span>
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

