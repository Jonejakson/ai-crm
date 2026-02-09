'use client'

import { useEffect, useState } from 'react'
import { SearchIcon, BuildingIcon } from '@/components/Icons'

interface AdvertisingIntegration {
  id: number
  platform: 'YANDEX_DIRECT' | 'AVITO'
  name: string | null
  isActive: boolean
  apiToken: string | null
  accountId: string | null
  webhookUrl: string | null
  autoCreateContact: boolean
  autoCreateDeal: boolean
  settings?: any
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

type RoutingMode = 'default' | 'avito_manager' | 'ad'
type RoutingPair = { externalId: string; userId: string }

export default function AdvertisingIntegrationsSection() {
  const [yandexIntegration, setYandexIntegration] = useState<AdvertisingIntegration | null>(null)
  const [avitoIntegration, setAvitoIntegration] = useState<AdvertisingIntegration | null>(null)
  const [loading, setLoading] = useState(true)
  const [sources, setSources] = useState<DealSource[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState<'YANDEX_DIRECT' | 'AVITO' | null>(null)
  const [origin, setOrigin] = useState('')

  const [formState, setFormState] = useState({
    name: '',
    apiToken: '',
    accountId: '',
    clientSecret: '',
    webhookSecret: '',
    routingMode: 'default' as RoutingMode,
    routingPairs: [] as RoutingPair[],
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
      const [yandexRes, avitoRes, sourcesRes, pipelinesRes, usersRes] = await Promise.all([
        fetch('/api/advertising/yandex-direct'),
        fetch('/api/advertising/avito'),
        fetch('/api/deal-sources'),
        fetch('/api/pipelines'),
        fetch('/api/admin/users'),
      ])

      if (yandexRes.ok) {
        const data = (await yandexRes.json()) as AdvertisingIntegration | null
        setYandexIntegration(data)
      }
      if (avitoRes.ok) {
        const data = (await avitoRes.json()) as AdvertisingIntegration | null
        setAvitoIntegration(data)
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
      console.error('[advertising-integrations][fetchInitialData]', fetchError)
      setError('Не удалось загрузить настройки. Попробуйте обновить страницу.')
    } finally {
      setLoading(false)
    }
  }

  function openCreateModal(platform: 'YANDEX_DIRECT' | 'AVITO') {
    setSelectedPlatform(platform)
    const existing = platform === 'YANDEX_DIRECT' ? yandexIntegration : avitoIntegration

    const existingRoutingMode: RoutingMode =
      (existing?.settings?.routing?.mode as RoutingMode) || 'default'

    const existingPairs: RoutingPair[] =
      existingRoutingMode === 'avito_manager'
        ? Object.entries(existing?.settings?.routing?.managerToUserId || {}).map(([k, v]: any) => ({
            externalId: String(k),
            userId: String(v),
          }))
        : existingRoutingMode === 'ad'
          ? Object.entries(existing?.settings?.routing?.adToUserId || {}).map(([k, v]: any) => ({
              externalId: String(k),
              userId: String(v),
            }))
          : []

    setFormState({
      name: existing?.name || '',
      apiToken: existing?.apiToken || '',
      accountId: existing?.accountId || '',
      clientSecret: '',
      webhookSecret: '',
      routingMode: existingRoutingMode,
      routingPairs: existingPairs,
      isActive: existing?.isActive ?? true,
      autoCreateContact: existing?.autoCreateContact ?? true,
      autoCreateDeal: existing?.autoCreateDeal ?? false,
      defaultSourceId: existing?.defaultSource?.id ? String(existing.defaultSource.id) : '',
      defaultPipelineId: existing?.defaultPipeline?.id ? String(existing.defaultPipeline.id) : '',
      defaultAssigneeId: existing?.defaultAssignee?.id ? String(existing.defaultAssignee.id) : '',
    })
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPlatform) return

    if (!formState.apiToken.trim()) {
      setError(selectedPlatform === 'YANDEX_DIRECT' ? 'OAuth токен обязателен' : 'Client ID обязателен')
      return
    }

    if (selectedPlatform === 'AVITO' && !formState.clientSecret.trim()) {
      setError('Client Secret обязателен')
      return
    }

    setProcessing(true)
    setError(null)

    const endpoint = selectedPlatform === 'YANDEX_DIRECT' 
      ? '/api/advertising/yandex-direct'
      : '/api/advertising/avito'

    const payload: any = {
      name: formState.name.trim() || null,
      isActive: formState.isActive,
      autoCreateContact: formState.autoCreateContact,
      autoCreateDeal: formState.autoCreateDeal,
      defaultSourceId: formState.defaultSourceId ? Number(formState.defaultSourceId) : null,
      defaultPipelineId: formState.defaultPipelineId ? Number(formState.defaultPipelineId) : null,
      defaultAssigneeId: formState.defaultAssigneeId ? Number(formState.defaultAssigneeId) : null,
      webhookSecret: formState.webhookSecret.trim() || null,
    }

    if (selectedPlatform === 'YANDEX_DIRECT') {
      payload.apiToken = formState.apiToken.trim()
      payload.accountId = formState.accountId.trim() || null
    } else {
      payload.clientId = formState.apiToken.trim()
      payload.clientSecret = formState.clientSecret.trim()
      payload.userId = formState.accountId.trim() || null

      const routing: any = { mode: formState.routingMode }
      if (formState.routingMode === 'avito_manager') {
        routing.managerToUserId = Object.fromEntries(
          (formState.routingPairs || [])
            .filter((p) => p.externalId.trim() && p.userId)
            .map((p) => [p.externalId.trim(), Number(p.userId)])
        )
      } else if (formState.routingMode === 'ad') {
        routing.adToUserId = Object.fromEntries(
          (formState.routingPairs || [])
            .filter((p) => p.externalId.trim() && p.userId)
            .map((p) => [p.externalId.trim(), Number(p.userId)])
        )
      }
      payload.settings = { routing }
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || 'Не удалось сохранить настройки')
      }

      setModalOpen(false)
      setSelectedPlatform(null)
      await fetchInitialData()
    } catch (saveError) {
      console.error('[advertising-integrations][save]', saveError)
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить настройки')
    } finally {
      setProcessing(false)
    }
  }

  function getPlatformName(platform: string) {
    return platform === 'YANDEX_DIRECT' ? 'Яндекс.Директ' : 'Авито'
  }

  function getPlatformIcon(platform: string) {
    return platform === 'YANDEX_DIRECT' ? <SearchIcon className="w-4 h-4" /> : <BuildingIcon className="w-4 h-4" />
  }

  return (
    <section className="space-y-4">
      <div className="glass-panel rounded-3xl p-6 space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              Рекламные интеграции
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                На стадии бета тестирования
              </span>
            </h2>
            <p className="text-sm text-[var(--muted)]">
              Подключите Яндекс.Директ и Авито для автоматического получения лидов из рекламы.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => openCreateModal('YANDEX_DIRECT')} className="btn-secondary text-sm">
              + Яндекс.Директ
            </button>
            <button onClick={() => openCreateModal('AVITO')} className="btn-secondary text-sm">
              + Авито
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
        ) : (
          <div className="space-y-4">
            {/* Яндекс.Директ */}
            {yandexIntegration ? (
              <IntegrationCard
                integration={yandexIntegration}
                origin={origin}
                onEdit={() => openCreateModal('YANDEX_DIRECT')}
                onToggle={async () => {
                  await openCreateModal('YANDEX_DIRECT')
                  setFormState(prev => ({ ...prev, isActive: !yandexIntegration.isActive }))
                  await handleSubmit(new Event('submit') as any)
                }}
              />
            ) : (
              <EmptyCard
                platform="YANDEX_DIRECT"
                onConnect={() => openCreateModal('YANDEX_DIRECT')}
              />
            )}

            {/* Авито */}
            {avitoIntegration ? (
              <IntegrationCard
                integration={avitoIntegration}
                origin={origin}
                onEdit={() => openCreateModal('AVITO')}
                onSync={async () => {
                  try {
                    setProcessing(true)
                    setError(null)
                    const res = await fetch('/api/advertising/avito/sync', { method: 'POST' })
                    const data = await res.json().catch(() => ({}))
                    if (!res.ok) throw new Error(data?.error || 'Sync failed')
                    await fetchInitialData()
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Sync failed')
                  } finally {
                    setProcessing(false)
                  }
                }}
                onToggle={async () => {
                  await openCreateModal('AVITO')
                  setFormState(prev => ({ ...prev, isActive: !avitoIntegration.isActive }))
                  await handleSubmit(new Event('submit') as any)
                }}
              />
            ) : (
              <EmptyCard
                platform="AVITO"
                onConnect={() => openCreateModal('AVITO')}
              />
            )}
          </div>
        )}
      </div>

      {modalOpen && selectedPlatform && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-[var(--foreground)]">
                  Настройка {getPlatformName(selectedPlatform)}
                </h3>
                <p className="text-sm text-[var(--muted)]">
                  {selectedPlatform === 'YANDEX_DIRECT' 
                    ? 'Подключите Яндекс.Директ для получения лидов из рекламы'
                    : 'Подключите Авито для получения заявок с объявлений'}
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-2xl text-[var(--muted)]">
                ✕
              </button>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              {selectedPlatform === 'YANDEX_DIRECT' ? (
                <>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      OAuth токен *
                    </label>
                    <input
                      type="text"
                      value={formState.apiToken}
                      onChange={(e) => setFormState((prev) => ({ ...prev, apiToken: e.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                      placeholder="y0_AgAxxxxx"
                      required
                    />
                    <p className="text-xs text-[var(--muted)] mt-1">
                      Получите в Яндекс.Директ → Настройки → API
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Client ID (опционально)
                    </label>
                    <input
                      type="text"
                      value={formState.accountId}
                      onChange={(e) => setFormState((prev) => ({ ...prev, accountId: e.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                      placeholder="12345678"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Client ID *
                    </label>
                    <input
                      type="text"
                      value={formState.apiToken}
                      onChange={(e) => setFormState((prev) => ({ ...prev, apiToken: e.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                      placeholder="client_id"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Client Secret *
                    </label>
                    <input
                      type="password"
                      value={formState.clientSecret}
                      onChange={(e) => setFormState((prev) => ({ ...prev, clientSecret: e.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                      placeholder="client_secret"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      User ID (опционально)
                    </label>
                    <input
                      type="text"
                      value={formState.accountId}
                      onChange={(e) => setFormState((prev) => ({ ...prev, accountId: e.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                      placeholder="user_id"
                    />
                  </div>
                </>
              )}

              {selectedPlatform === 'AVITO' && (
                <div className="rounded-2xl border border-[var(--border)] p-4">
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-[var(--foreground)]">Распределение заявок</p>
                    <p className="text-xs text-[var(--muted)] mt-1">
                      Авито не всегда умеет отправлять webhook. Мы забираем обращения из Avito API и распределяем их
                      либо по менеджеру Авито, либо по объявлению (itemId/adId).
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        Режим
                      </label>
                      <select
                        value={formState.routingMode}
                        onChange={(e) =>
                          setFormState((prev) => ({
                            ...prev,
                            routingMode: e.target.value as RoutingMode,
                            routingPairs: [],
                          }))
                        }
                        className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                      >
                        <option value="default">По умолчанию (ответственный из настроек)</option>
                        <option value="avito_manager">По менеджеру Авито (managerId → user)</option>
                        <option value="ad">По объявлению (itemId/adId → user)</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() =>
                          setFormState((prev) => ({
                            ...prev,
                            routingPairs: [...(prev.routingPairs || []), { externalId: '', userId: '' }],
                          }))
                        }
                        className="rounded-2xl border border-[var(--border)] px-4 py-2 text-sm"
                        disabled={formState.routingMode === 'default'}
                      >
                        + Добавить правило
                      </button>
                    </div>
                  </div>

                  {formState.routingMode !== 'default' && (
                    <div className="mt-4 space-y-2">
                      {(formState.routingPairs || []).length === 0 ? (
                        <p className="text-xs text-[var(--muted)]">
                          Добавь хотя бы одно правило (например, managerId или itemId → пользователь CRM).
                        </p>
                      ) : (
                        (formState.routingPairs || []).map((pair, idx) => (
                          <div key={idx} className="grid gap-2 md:grid-cols-[1fr_1fr_auto] items-center">
                            <input
                              type="text"
                              value={pair.externalId}
                              onChange={(e) =>
                                setFormState((prev) => ({
                                  ...prev,
                                  routingPairs: (prev.routingPairs || []).map((p, i) =>
                                    i === idx ? { ...p, externalId: e.target.value } : p
                                  ),
                                }))
                              }
                              className="w-full rounded-2xl border border-[var(--border)] px-4 py-2 text-sm"
                              placeholder={formState.routingMode === 'ad' ? 'itemId/adId (например 123456)' : 'managerId'}
                            />
                            <select
                              value={pair.userId}
                              onChange={(e) =>
                                setFormState((prev) => ({
                                  ...prev,
                                  routingPairs: (prev.routingPairs || []).map((p, i) =>
                                    i === idx ? { ...p, userId: e.target.value } : p
                                  ),
                                }))
                              }
                              className="w-full rounded-2xl border border-[var(--border)] px-4 py-2 text-sm"
                            >
                              <option value="">Выбрать пользователя</option>
                              {users.map((u) => (
                                <option key={u.id} value={String(u.id)}>
                                  {u.name} ({u.email})
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() =>
                                setFormState((prev) => ({
                                  ...prev,
                                  routingPairs: (prev.routingPairs || []).filter((_, i) => i !== idx),
                                }))
                              }
                              className="rounded-2xl border border-[var(--border)] px-3 py-2 text-sm"
                              aria-label="Удалить правило"
                            >
                              ✕
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Webhook Secret (для безопасности)
                </label>
                <input
                  type="text"
                  value={formState.webhookSecret}
                  onChange={(e) => setFormState((prev) => ({ ...prev, webhookSecret: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  placeholder="your_secret_token"
                />
                <p className="text-xs text-[var(--muted)] mt-1">
                  Используйте этот секрет при настройке webhook в рекламной системе
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
                <div>
                  <span className="text-sm text-[var(--muted)]">Автоматически создавать сделки</span>
                  {selectedPlatform === 'AVITO' && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                      Для создания сделок из сообщений Авито включите этот пункт и выберите воронку выше.
                    </p>
                  )}
                </div>
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
                <p className="font-semibold text-blue-900 mb-2">
                  {selectedPlatform === 'AVITO' ? '📚 URL (устаревший webhook, если доступен):' : '📚 Webhook URL:'}
                </p>
                <code className="bg-gray-100 px-2 py-1 rounded text-xs block mb-2">
                  {origin}/api/advertising/{selectedPlatform.toLowerCase().replace('_', '-')}/webhook
                </code>
                <p className="text-blue-800">
                  {selectedPlatform === 'YANDEX_DIRECT' 
                    ? 'Используйте этот URL при настройке Call Tracking в Яндекс.Директ'
                    : 'Если в вашем Avito API нет исходящих webhook — используйте кнопку “Синхронизировать сейчас” (polling).'}
                </p>
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

function IntegrationCard({ 
  integration, 
  origin, 
  onEdit, 
  onToggle,
  onSync
}: { 
  integration: AdvertisingIntegration
  origin: string
  onEdit: () => void
  onToggle: () => void
  onSync?: () => void
}) {
  const platformName = integration.platform === 'YANDEX_DIRECT' ? 'Яндекс.Директ' : 'Авито'
  const platformIcon = integration.platform === 'YANDEX_DIRECT' ? <SearchIcon className="w-4 h-4" /> : <BuildingIcon className="w-4 h-4" />
  const webhookPath = integration.platform === 'YANDEX_DIRECT' 
    ? '/api/advertising/yandex-direct/webhook'
    : '/api/advertising/avito/webhook'

  return (
    <div className="rounded-2xl border border-[var(--border)] p-5 shadow-sm bg-white/80">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{platformIcon}</span>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              {platformName}
            </h3>
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
          <div className="space-y-2 text-sm text-[var(--muted)]">
            <div>
              {integration.platform === 'AVITO' ? (
                <>
                  Sync (polling): <code className="bg-gray-100 px-2 py-1 rounded text-xs">/api/advertising/avito/sync</code>
                </>
              ) : (
                <>
                  Webhook URL:{' '}
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                    {origin}{webhookPath}
                  </code>
                </>
              )}
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
          {integration.platform === 'AVITO' && (
            <button
              onClick={onSync}
              className="rounded-2xl border border-[var(--border)] px-4 py-2 text-sm"
              disabled={!onSync}
            >
              Синхронизировать
            </button>
          )}
          <button
            onClick={onToggle}
            className="rounded-2xl border border-[var(--border)] px-4 py-2 text-sm"
          >
            {integration.isActive ? 'Выключить' : 'Включить'}
          </button>
          <button
            onClick={onEdit}
            className="rounded-2xl border border-[var(--border)] px-4 py-2 text-sm"
          >
            Редактировать
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyCard({ 
  platform, 
  onConnect 
}: { 
  platform: 'YANDEX_DIRECT' | 'AVITO'
  onConnect: () => void
}) {
  const platformName = platform === 'YANDEX_DIRECT' ? 'Яндекс.Директ' : 'Авито'
  const platformIcon = platform === 'YANDEX_DIRECT' ? <SearchIcon className="w-4 h-4" /> : <BuildingIcon className="w-4 h-4" />

  return (
    <div className="rounded-2xl border border-[var(--border)] p-5 shadow-sm bg-white/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{platformIcon}</span>
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">{platformName}</h3>
            <p className="text-sm text-[var(--muted)]">Не подключено</p>
          </div>
        </div>
        <button onClick={onConnect} className="btn-secondary text-sm">
          Подключить
        </button>
      </div>
    </div>
  )
}

