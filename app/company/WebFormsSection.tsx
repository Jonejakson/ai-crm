'use client'

import { useEffect, useMemo, useState } from 'react'
import { getFieldLibraryList, sanitizeFormFields, WebFormFieldConfig, WebFormFieldKey } from '@/lib/webforms'
import { parsePipelineStages } from '@/lib/pipelines'
import { InfoIcon } from '@/components/Icons'

interface DealSource {
  id: number
  name: string
}

interface Pipeline {
  id: number
  name: string
  stages: string | null
}

interface CompanyUser {
  id: number
  name: string
  email: string
}

interface WebFormDto {
  id: number
  name: string
  token: string
  isActive: boolean
  displayType: string
  buttonText: string | null
  successMessage: string | null
  redirectUrl: string | null
  initialStage: string | null
  createdAt: string
  sourceId: number | null
  pipelineId: number | null
  defaultAssigneeId: number | null
  fields: unknown
  source?: DealSource | null
  pipeline?: Pipeline | null
  defaultAssignee?: CompanyUser | null
}

const FIELD_LIBRARY = getFieldLibraryList()

interface FormState {
  name: string
  sourceId: string
  pipelineId: string
  initialStage: string
  defaultAssigneeId: string
  successMessage: string
  redirectUrl: string
  submitButtonLabel: string
  displayType: "inline" | "popup"
  buttonText: string
  fields: WebFormFieldConfig[]
  isActive: boolean
}

const DEFAULT_STATE: FormState = {
  name: '',
  sourceId: '',
  pipelineId: '',
  initialStage: '',
  defaultAssigneeId: '',
  successMessage: 'Спасибо! Мы получили вашу заявку и свяжемся с вами в ближайшее время.',
  redirectUrl: '',
  submitButtonLabel: 'Отправить',
  displayType: 'inline',
  buttonText: 'Оставить заявку',
  fields: FIELD_LIBRARY.map((field, index) => ({ ...field, order: index })),
  isActive: true,
}

export default function WebFormsSection() {
  const [forms, setForms] = useState<WebFormDto[]>([])
  const [loading, setLoading] = useState(true)
  const [sources, setSources] = useState<DealSource[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formState, setFormState] = useState<FormState>(DEFAULT_STATE)
  const [origin, setOrigin] = useState('')
  const [copySuccessId, setCopySuccessId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedSnippets, setExpandedSnippets] = useState<Set<number>>(new Set())

  useEffect(() => {
    setOrigin(window.location.origin)
    fetchInitialData()
  }, [])

  const stageOptions = useMemo(() => {
    if (!formState.pipelineId) return []
    const pipeline = pipelines.find((p) => String(p.id) === formState.pipelineId)
    if (!pipeline) return []
    return parsePipelineStages(pipeline.stages).map((stage) => stage.name)
  }, [pipelines, formState.pipelineId])

  async function fetchInitialData() {
    try {
      setLoading(true)
      const [formsRes, sourcesRes, pipelinesRes, usersRes] = await Promise.all([
        fetch('/api/webforms'),
        fetch('/api/deal-sources'),
        fetch('/api/pipelines'),
        fetch('/api/admin/users'),
      ])

      if (formsRes.ok) {
        const data = (await formsRes.json()) as WebFormDto[]
        setForms(Array.isArray(data) ? data : [])
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
      console.error('[webforms][fetchInitialData]', fetchError)
      setError('Не удалось загрузить формы. Попробуйте обновить страницу.')
    } finally {
      setLoading(false)
    }
  }

  function openCreateModal() {
    setEditingId(null)
    setFormState({
      ...DEFAULT_STATE,
      fields: FIELD_LIBRARY.map((field, index) => ({ ...field, order: index })),
    })
    setModalOpen(true)
  }

  function openEditModal(form: WebFormDto) {
    const sanitized = sanitizeFormFields(form.fields)
    setEditingId(form.id)
    setFormState({
      name: form.name,
      sourceId: form.sourceId ? String(form.sourceId) : '',
      pipelineId: form.pipelineId ? String(form.pipelineId) : '',
      initialStage: form.initialStage || '',
      defaultAssigneeId: form.defaultAssigneeId ? String(form.defaultAssigneeId) : '',
      successMessage: form.successMessage || DEFAULT_STATE.successMessage,
      redirectUrl: form.redirectUrl || '',
      submitButtonLabel: sanitized.submitButtonLabel || 'Отправить',
      displayType: (form.displayType === "popup" ? "popup" : "inline") as "inline" | "popup",
      buttonText: form.buttonText || DEFAULT_STATE.buttonText,
      fields: sanitized.fields.map((field, index) => ({ ...field, order: index })),
      isActive: form.isActive,
    })
    setModalOpen(true)
  }

  function handleFieldChange(key: WebFormFieldKey, changes: Partial<WebFormFieldConfig>) {
    setFormState((prev) => ({
      ...prev,
      fields: prev.fields.map((field) =>
        field.key === key
          ? { ...field, ...changes, order: field.order }
          : field
      ),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formState.name.trim()) {
      setError('Введите название формы')
      return
    }

    setProcessing(true)
    setError(null)

    const payload = {
      name: formState.name.trim(),
      sourceId: formState.sourceId ? Number(formState.sourceId) : null,
      pipelineId: formState.pipelineId ? Number(formState.pipelineId) : null,
      initialStage: formState.initialStage || null,
      defaultAssigneeId: formState.defaultAssigneeId ? Number(formState.defaultAssigneeId) : null,
      successMessage: formState.successMessage,
      redirectUrl: formState.redirectUrl || null,
      isActive: formState.isActive,
      displayType: formState.displayType,
      buttonText: formState.displayType === "popup" ? formState.buttonText : null,
      fields: {
        fields: formState.fields.map((field, index) => ({ ...field, order: index })),
        submitButtonLabel: formState.submitButtonLabel,
      },
    }

    try {
      const endpoint = editingId ? `/api/webforms/${editingId}` : '/api/webforms'
      const method = editingId ? 'PUT' : 'POST'
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || 'Не удалось сохранить форму')
      }

      setModalOpen(false)
      setEditingId(null)
      await fetchInitialData()
    } catch (saveError) {
      console.error('[webforms][save]', saveError)
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить форму')
    } finally {
      setProcessing(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Удалить форму? Это действие нельзя отменить.')) return
    try {
      const response = await fetch(`/api/webforms/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Не удалось удалить форму')
      await fetchInitialData()
    } catch (deleteError) {
      console.error('[webforms][delete]', deleteError)
      setError('Не удалось удалить форму')
    }
  }

  async function handleToggle(form: WebFormDto) {
    try {
      const response = await fetch(`/api/webforms/${form.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !form.isActive }),
      })
      if (!response.ok) throw new Error('Не удалось изменить статус')
      await fetchInitialData()
    } catch (toggleError) {
      console.error('[webforms][toggle]', toggleError)
      setError('Не удалось изменить статус формы')
    }
  }

  function getEmbedSnippet(form: WebFormDto) {
    const base = origin || 'https://your-domain.com'
    const embedUrl = `${base}/api/webforms/public/${form.token}/embed`

    // ВАЖНО: сниппет должен быть валидным HTML. Нельзя вставлять комментарии внутрь открывающего тега <div ...>
    const workingSnippet = [
      `<div class="pocketcrm-form" data-webform-token="${form.token}"></div>`,
      `<script async src="${embedUrl}"></script>`,
    ].join('\n')

    // Опциональные примеры кастомизации оставляем в комментарии (вне тега), чтобы не ломать разметку.
    const customizationHelp = `<!-- ============================================ -->
<!-- ОПЦИОНАЛЬНО: кастомизация виджета -->
<!-- Добавьте data-атрибуты в DIV контейнер -->
<!-- ============================================ -->

<!-- Цвета -->
<!-- data-primary-color="#10b981"      Основной цвет (градиент слева + фокус) -->
<!-- data-secondary-color="#0ea5e9"    Вторичный цвет (градиент справа) -->
<!-- data-overlay-color="rgba(0,0,0,0.5)" Затемнение фона (только для popup) -->
<!-- data-text-color="#111827"        Цвет текста -->
<!-- data-border-color="#d1d5db"      Цвет границ полей -->
<!-- data-success-color="#059669"     Цвет успеха -->
<!-- data-error-color="#b91c1c"       Цвет ошибки -->
<!-- data-bg-color="#ffffff"          Цвет фона попапа (только для popup) -->

<!-- Кнопка (только для режима "Кнопка с попапом") -->
<!-- data-button-width="260"          ширина: 260 | 260px | 100% -->
<!-- data-button-height="54"          высота: 54 | 54px -->
<!-- data-button-font-size="18"       размер шрифта: 18 | 18px -->
<!-- data-button-padding="0 24px"     padding CSS -->

<!-- Пример (можно заменить ваш DIV на этот и поменять значения):
<div class="pocketcrm-form"
  data-webform-token="${form.token}"
  data-primary-color="#10b981"
  data-secondary-color="#0ea5e9"
  data-button-width="260"
  data-button-height="54"
  data-button-font-size="18"
  data-button-padding="0 24px"
></div>
-->`

    return `${workingSnippet}\n\n${customizationHelp}`
  }

  async function copySnippet(form: WebFormDto) {
    try {
      await navigator.clipboard.writeText(getEmbedSnippet(form))
      setCopySuccessId(form.id)
      setTimeout(() => setCopySuccessId(null), 2500)
    } catch (clipError) {
      console.error('[webforms][copy]', clipError)
      setError('Не удалось скопировать код')
    }
  }

  return (
    <section className="space-y-4">
      <div className="glass-panel rounded-3xl p-6 space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Веб-формы и виджеты</h2>
            <p className="text-sm text-[var(--muted)]">
              Получайте заявки с сайтов и лендингов напрямую в CRM.
            </p>
          </div>
          <button onClick={openCreateModal} className="btn-primary w-full lg:w-auto">
            + Создать форму
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-[var(--muted)]">Загрузка...</div>
        ) : forms.length === 0 ? (
          <div className="py-12 text-center text-[var(--muted)]">
            <p className="mb-4">У вас ещё нет форм.</p>
            <button onClick={openCreateModal} className="btn-secondary">
              Создать первую форму
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {forms.map((form) => (
              <div
                key={form.id}
                className="rounded-2xl border border-[var(--border)] p-5 shadow-sm bg-white/80"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-[var(--foreground)]">{form.name}</h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          form.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}
                      >
                        {form.isActive ? 'Активна' : 'Выключена'}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--muted)]">
                      Источник: {form.source?.name || 'Не указан'} • Воронка:{' '}
                      {form.pipeline?.name || 'Не указана'}
                    </p>
                    <p className="text-sm text-[var(--muted)]">
                      Ответственный: {form.defaultAssignee?.name || 'Не назначен'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => copySnippet(form)}
                      className="btn-secondary text-sm"
                    >
                      {copySuccessId === form.id ? 'Скопировано!' : 'Код для сайта'}
                    </button>
                    <button
                      onClick={() => handleToggle(form)}
                      className="rounded-2xl border border-[var(--border)] px-4 py-2 text-sm"
                    >
                      {form.isActive ? 'Выключить' : 'Включить'}
                    </button>
                    <button
                      onClick={() => openEditModal(form)}
                      className="rounded-2xl border border-[var(--border)] px-4 py-2 text-sm"
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={() => handleDelete(form.id)}
                      className="rounded-2xl border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
                <div className="mt-4 rounded-xl bg-[var(--background-soft)] px-4 py-3 text-xs text-[var(--muted)]">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold">Сниппет для сайта:</p>
                    <button
                      onClick={() => {
                        setExpandedSnippets((prev) => {
                          const next = new Set(prev)
                          if (next.has(form.id)) {
                            next.delete(form.id)
                          } else {
                            next.add(form.id)
                          }
                          return next
                        })
                      }}
                      className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                      title={expandedSnippets.has(form.id) ? 'Свернуть' : 'Развернуть'}
                    >
                      {expandedSnippets.has(form.id) ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {expandedSnippets.has(form.id) && (
                    <>
                      <pre className="mt-1 overflow-auto whitespace-pre-wrap break-all text-[11px] bg-gray-50 p-3 rounded-lg">
                        {getEmbedSnippet(form)}
                      </pre>
                      <p className="mt-3 text-[10px] text-[var(--muted)]">
                        <InfoIcon className="w-4 h-4 inline mr-1" /> <strong>Совет:</strong> Используйте data-атрибуты для кастомизации цветов и (в popup режиме) размеров кнопки под ваш сайт
                      </p>
                    </>
                  )}
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
                  {editingId ? 'Редактирование формы' : 'Новая форма'}
                </h3>
                <p className="text-sm text-[var(--muted)]">
                  Заполните основные параметры и выберите поля формы
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
                    Название *
                  </label>
                  <input
                    type="text"
                    value={formState.name}
                    onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Источник
                  </label>
                  <select
                    value={formState.sourceId}
                    onChange={(e) => setFormState((prev) => ({ ...prev, sourceId: e.target.value }))}
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
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Воронка
                  </label>
                  <select
                    value={formState.pipelineId}
                    onChange={(e) => {
                      const value = e.target.value
                      setFormState((prev) => ({
                        ...prev,
                        pipelineId: value,
                        initialStage: '',
                      }))
                    }}
                    className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  >
                    <option value="">Не привязана</option>
                    {pipelines.map((pipeline) => (
                      <option key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Стартовый этап
                  </label>
                  <select
                    value={formState.initialStage}
                    onChange={(e) => setFormState((prev) => ({ ...prev, initialStage: e.target.value }))}
                    disabled={!formState.pipelineId || stageOptions.length === 0}
                    className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm disabled:bg-gray-100 disabled:text-gray-400 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  >
                    {stageOptions.length === 0 ? (
                      <option value="">Выберите воронку</option>
                    ) : (
                      stageOptions.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Ответственный
                  </label>
                  <select
                    value={formState.defaultAssigneeId}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, defaultAssigneeId: e.target.value }))
                    }
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

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Сообщение об успехе
                  </label>
                  <textarea
                    rows={3}
                    value={formState.successMessage}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, successMessage: e.target.value }))
                    }
                    className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Redirect URL (опционально)
                  </label>
                  <input
                    type="url"
                    value={formState.redirectUrl}
                    onChange={(e) => setFormState((prev) => ({ ...prev, redirectUrl: e.target.value }))}
                    placeholder="https://example.com/thanks"
                    className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Тип отображения
                  </label>
                  <select
                    value={formState.displayType}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        displayType: e.target.value as "inline" | "popup",
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  >
                    <option value="inline">Встроенная форма</option>
                    <option value="popup">Кнопка с попапом</option>
                  </select>
                </div>
                {formState.displayType === "popup" && (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Текст кнопки
                    </label>
                    <input
                      type="text"
                      value={formState.buttonText}
                      onChange={(e) => setFormState((prev) => ({ ...prev, buttonText: e.target.value }))}
                      placeholder="Оставить заявку"
                      className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Поля формы
                </label>
                <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/70 p-4">
                  {formState.fields.map((field) => (
                    <div
                      key={field.key}
                      className="flex flex-col gap-2 rounded-xl border border-[var(--border)] p-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={field.enabled}
                            onChange={(e) => handleFieldChange(field.key, { enabled: e.target.checked })}
                          />
                          <span className="text-sm font-semibold text-[var(--foreground)]">
                            {field.label}
                          </span>
                        </div>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          <input
                            type="text"
                            value={field.label}
                            disabled={!field.enabled}
                            onChange={(e) => handleFieldChange(field.key, { label: e.target.value })}
                            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm disabled:bg-gray-100"
                          />
                          <input
                            type="text"
                            value={field.placeholder || ''}
                            disabled={!field.enabled}
                            onChange={(e) => handleFieldChange(field.key, { placeholder: e.target.value })}
                            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm disabled:bg-gray-100"
                            placeholder="Placeholder"
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                        <input
                          type="checkbox"
                          checked={field.required}
                          disabled={!field.enabled}
                          onChange={(e) => handleFieldChange(field.key, { required: e.target.checked })}
                        />
                        Обязательно
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formState.isActive}
                  onChange={(e) => setFormState((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
                <span className="text-sm text-[var(--muted)]">Форма активна</span>
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

