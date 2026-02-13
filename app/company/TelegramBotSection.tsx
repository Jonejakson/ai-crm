'use client'

import { useEffect, useState } from 'react'

interface TelegramBotIntegration {
  id: number
  platform: 'TELEGRAM'
  isActive: boolean
  botToken: string | null
  webhookUrl: string | null
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

export default function TelegramBotSection() {
  const [integration, setIntegration] = useState<TelegramBotIntegration | null>(null)
  const [loading, setLoading] = useState(true)
  const [sources, setSources] = useState<DealSource[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')
  const [settingWebhook, setSettingWebhook] = useState(false)

  const [formState, setFormState] = useState({
    botToken: '',
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
        fetch('/api/messaging/telegram-bot'),
        fetch('/api/deal-sources'),
        fetch('/api/pipelines'),
        fetch('/api/admin/users'),
      ])

      if (integrationRes.ok) {
        const data = (await integrationRes.json()) as TelegramBotIntegration[]
        setIntegration(data.length > 0 ? data[0] : null)
        if (data.length > 0) {
          setFormState({
            botToken: data[0].botToken || '',
            isActive: data[0].isActive,
            autoCreateContact: data[0].autoCreateContact,
            autoCreateDeal: data[0].autoCreateDeal,
            defaultSourceId: data[0].defaultSource?.id ? String(data[0].defaultSource.id) : '',
            defaultPipelineId: data[0].defaultPipeline?.id ? String(data[0].defaultPipeline.id) : '',
            defaultAssigneeId: data[0].defaultAssignee?.id ? String(data[0].defaultAssignee.id) : '',
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
      console.error('[telegram-bot][fetchInitialData]', fetchError)
      setError('Не удалось загрузить настройки. Попробуйте обновить страницу.')
    } finally {
      setLoading(false)
    }
  }

  function openCreateModal() {
    setFormState({
      botToken: '',
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
    if (!formState.botToken.trim()) {
      setError('Bot token обязателен')
      return
    }
    if (!formState.defaultAssigneeId) {
      setError('Выберите ответственного')
      return
    }

    setProcessing(true)
    setError(null)

    const payload: any = {
      botToken: formState.botToken.trim(),
      isActive: formState.isActive,
      autoCreateContact: formState.autoCreateContact,
      autoCreateDeal: formState.autoCreateDeal,
      defaultSourceId: formState.defaultSourceId ? Number(formState.defaultSourceId) : null,
      defaultPipelineId: formState.defaultPipelineId ? Number(formState.defaultPipelineId) : null,
      defaultAssigneeId: formState.defaultAssigneeId ? Number(formState.defaultAssigneeId) : null,
    }

    try {
      const response = await fetch('/api/messaging/telegram-bot', {
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
      console.error('[telegram-bot][save]', saveError)
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить настройки')
    } finally {
      setProcessing(false)
    }
  }

  async function handleSetWebhook() {
    if (!integration?.botToken) {
      setError('Сначала настройте бота')
      return
    }

    setSettingWebhook(true)
    setError(null)

    const webhookUrl = `${origin}/api/messaging/telegram-bot/webhook`

    try {
      const response = await fetch('/api/messaging/telegram-bot/set-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || 'Не удалось установить webhook')
      }

      await fetchInitialData()
      setError(null)
      alert('Webhook успешно установлен! Теперь бот будет получать сообщения.')
    } catch (webhookError) {
      console.error('[telegram-bot][set-webhook]', webhookError)
      setError(webhookError instanceof Error ? webhookError.message : 'Не удалось установить webhook')
    } finally {
      setSettingWebhook(false)
    }
  }

  async function handleToggle() {
    if (!integration) return

    try {
      setError(null)
      const response = await fetch('/api/messaging/telegram-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: integration.botToken,
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
      console.error('[telegram-bot][toggle]', toggleError)
      setError('Не удалось изменить статус')
    }
  }

  async function handleDelete() {
    if (!integration) return
    if (!confirm('Удалить интеграцию Telegram Bot? Бот будет отключён, данные настроек удалены.')) return

    try {
      setError(null)
      setProcessing(true)
      const response = await fetch('/api/messaging/telegram-bot', { method: 'DELETE' })
      if (!response.ok) throw new Error('Не удалось удалить интеграцию')
      setIntegration(null)
      setFormState({
        botToken: '',
        isActive: true,
        autoCreateContact: true,
        autoCreateDeal: false,
        defaultSourceId: '',
        defaultPipelineId: '',
        defaultAssigneeId: '',
      })
      await fetchInitialData()
    } catch (deleteError) {
      console.error('[telegram-bot][delete]', deleteError)
      setError('Не удалось удалить интеграцию')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="glass-panel rounded-3xl p-6 space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              Telegram Bot
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                На стадии бета тестирования
              </span>
            </h2>
            <p className="text-sm text-[var(--muted)]">
              Подключите Telegram бота для автоматического получения заявок от клиентов.
            </p>
          </div>
          {!integration && (
            <button onClick={openCreateModal} className="btn-primary text-sm">
              + Подключить бота
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
            <p className="mb-4">Telegram бот не настроен.</p>
            <button onClick={openCreateModal} className="btn-secondary">
              Подключить бота
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] p-5 shadow-sm bg-white/80">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">
                      Telegram Bot
                      <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        На стадии бета тестирования
                      </span>
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
                        {integration.webhookUrl || 'Не установлен'}
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
                    {integration.defaultAssignee && (
                      <div>
                        Ответственный: {integration.defaultAssignee.name} ({integration.defaultAssignee.email})
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!integration.webhookUrl && (
                    <button
                      onClick={handleSetWebhook}
                      disabled={settingWebhook}
                      className="rounded-2xl border border-[var(--border)] px-4 py-2 text-sm"
                    >
                      {settingWebhook ? 'Установка...' : '🔗 Установить webhook'}
                    </button>
                  )}
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
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={processing}
                    className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    {processing ? 'Удаление…' : 'Удалить интеграцию'}
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
                  Настройка Telegram бота
                  <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                    На стадии бета тестирования
                  </span>
                </h3>
                <p className="text-sm text-[var(--muted)]">
                  Получите токен бота у @BotFather в Telegram
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-2xl text-[var(--muted)]">
                ✕
              </button>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Bot Token *
                </label>
                <input
                  type="text"
                  value={formState.botToken}
                  onChange={(e) => setFormState((prev) => ({ ...prev, botToken: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                  required
                />
                <p className="text-xs text-[var(--muted)] mt-1">
                  Получите токен у @BotFather в Telegram: /newbot
                </p>
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
                <span className="text-sm text-[var(--muted)]">Бот активен</span>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm">
                <p className="font-semibold text-blue-900 mb-2">📚 Как использовать:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-800">
                  <li>Создайте бота через @BotFather в Telegram</li>
                  <li>Скопируйте токен бота и вставьте в поле выше</li>
                  <li>Сохраните настройки</li>
                  <li>Нажмите "Установить webhook" для активации</li>
                  <li>Теперь все сообщения боту будут автоматически создавать контакты и сделки</li>
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

