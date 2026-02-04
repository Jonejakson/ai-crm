'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import WebFormsSection from '@/app/company/WebFormsSection'
import WebhookIntegrationsSection from '@/app/company/WebhookIntegrationsSection'
import TelegramBotSection from '@/app/company/TelegramBotSection'
import WhatsAppSection from '@/app/company/WhatsAppSection'
import AdvertisingIntegrationsSection from '@/app/company/AdvertisingIntegrationsSection'
import MoyskladSection from '@/app/company/MoyskladSection'
import MigrationSection from '@/app/company/MigrationSection'

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated' && session?.user?.role !== 'admin') {
      router.push('/')
    }
  }, [status, session?.user?.role, router])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4" />
          <p className="text-[var(--muted)]">Загрузка настроек...</p>
        </div>
      </div>
    )
  }

  if (session?.user?.role !== 'admin') {
    return null
  }

  return (
    <div className="space-y-8 w-full">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Интеграции и настройки</p>
        <h1 className="text-3xl font-semibold text-[var(--foreground)]">
          Настройки
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Источники сделок, интеграции и миграция данных.
        </p>
      </div>

      {/* Источники сделок */}
      <section className="space-y-4">
        <div className="glass-panel rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Источники сделок</h2>
              <p className="text-sm text-[var(--muted)]">Настройте источники сделок и привяжите их к воронкам</p>
            </div>
          </div>
          <DealSourcesManagerWithAddButton />
        </div>
      </section>

      {/* Типы сделок */}
      <section className="space-y-4">
        <div className="glass-panel rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Типы сделок</h2>
              <p className="text-sm text-[var(--muted)]">Настройте типы сделок для вашей компании</p>
            </div>
          </div>
          <DealTypesManagerWithAddButton />
        </div>
      </section>

      <WebFormsSection />
      <WebhookIntegrationsSection />
      <TelegramBotSection />
      <WhatsAppSection />
      <AdvertisingIntegrationsSection />
      <MoyskladSection />
      <MigrationSection />
    </div>
  )
}

function DealSourcesManagerWithAddButton() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSource, setEditingSource] = useState<{id: number, name: string, pipelineId: number | null} | null>(null)
  const [formData, setFormData] = useState({ name: '', pipelineId: '' })

  return (
    <>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => {
            setEditingSource(null)
            setFormData({ name: '', pipelineId: '' })
            setModalOpen(true)
          }}
          className="btn-primary text-sm"
        >
          + Добавить источник
        </button>
      </div>
      <DealSourcesManager
        modalOpen={modalOpen}
        setModalOpen={setModalOpen}
        editingSource={editingSource}
        setEditingSource={setEditingSource}
        formData={formData}
        setFormData={setFormData}
      />
    </>
  )
}

function DealTypesManagerWithAddButton() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingType, setEditingType] = useState<{id: number, name: string} | null>(null)
  const [formData, setFormData] = useState({ name: '' })

  return (
    <>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => {
            setEditingType(null)
            setFormData({ name: '' })
            setModalOpen(true)
          }}
          className="btn-primary text-sm"
        >
          + Добавить тип
        </button>
      </div>
      <DealTypesManager
        modalOpen={modalOpen}
        setModalOpen={setModalOpen}
        editingType={editingType}
        setEditingType={setEditingType}
        formData={formData}
        setFormData={setFormData}
      />
    </>
  )
}

function DealSourcesManager({
  modalOpen: externalModalOpen,
  setModalOpen: setExternalModalOpen,
  editingSource: externalEditingSource,
  setEditingSource: setExternalEditingSource,
  formData: externalFormData,
  setFormData: setExternalFormData,
}: {
  modalOpen?: boolean
  setModalOpen?: (open: boolean) => void
  editingSource?: {id: number, name: string, pipelineId: number | null} | null
  setEditingSource?: (source: {id: number, name: string, pipelineId: number | null} | null) => void
  formData?: { name: string, pipelineId: string }
  setFormData?: (data: { name: string, pipelineId: string }) => void
}) {
  const [sources, setSources] = useState<Array<{id: number, name: string, pipelineId: number | null, pipeline: {id: number, name: string} | null}>>([])
  const [pipelines, setPipelines] = useState<Array<{id: number, name: string}>>([])
  const [loading, setLoading] = useState(true)
  const [internalModalOpen, setInternalModalOpen] = useState(false)
  const [internalEditingSource, setInternalEditingSource] = useState<{id: number, name: string, pipelineId: number | null} | null>(null)
  const [internalFormData, setInternalFormData] = useState({ name: '', pipelineId: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isModalOpen = externalModalOpen !== undefined ? externalModalOpen : internalModalOpen
  const setIsModalOpen = setExternalModalOpen || setInternalModalOpen
  const currentEditingSource = externalEditingSource !== undefined ? externalEditingSource : internalEditingSource
  const setCurrentEditingSource = setExternalEditingSource || setInternalEditingSource
  const currentFormData = externalFormData || internalFormData
  const setCurrentFormData = setExternalFormData || setInternalFormData

  useEffect(() => {
    fetchSources()
    fetchPipelines()
  }, [])

  const fetchSources = async () => {
    try {
      const response = await fetch('/api/deal-sources')
      if (response.ok) {
        const data = await response.json()
        setSources(data || [])
      }
    } catch (err) {
      console.error('Error fetching sources:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchPipelines = async () => {
    try {
      const response = await fetch('/api/pipelines')
      if (response.ok) {
        const data = await response.json()
        setPipelines(data || [])
      }
    } catch (err) {
      console.error('Error fetching pipelines:', err)
    }
  }

  const handleSave = async () => {
    if (!currentFormData.name.trim()) {
      setError('Название обязательно')
      return
    }
    setSaving(true)
    setError('')
    try {
      const url = '/api/deal-sources'
      const method = currentEditingSource ? 'PUT' : 'POST'
      const body = currentEditingSource
        ? { id: currentEditingSource.id, name: currentFormData.name, pipelineId: currentFormData.pipelineId ? parseInt(currentFormData.pipelineId) : null }
        : { name: currentFormData.name, pipelineId: currentFormData.pipelineId ? parseInt(currentFormData.pipelineId) : null }
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (response.ok) {
        await fetchSources()
        setIsModalOpen(false)
        setCurrentEditingSource(null)
        setCurrentFormData({ name: '', pipelineId: '' })
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Ошибка сохранения')
      }
    } catch {
      setError('Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот источник?')) return
    try {
      const response = await fetch(`/api/deal-sources?id=${id}`, { method: 'DELETE' })
      if (response.ok) await fetchSources()
    } catch (err) {
      console.error('Error deleting source:', err)
    }
  }

  const handleEdit = (source: {id: number, name: string, pipelineId: number | null}) => {
    setCurrentEditingSource(source)
    setCurrentFormData({ name: source.name, pipelineId: source.pipelineId ? source.pipelineId.toString() : '' })
    setIsModalOpen(true)
  }

  if (loading) return <div className="text-center py-4 text-[var(--muted)]">Загрузка...</div>

  return (
    <>
      <div className="space-y-2">
        {sources.length === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-4">Нет источников. Добавьте первый источник.</p>
        ) : (
          sources.map((source) => (
            <div key={source.id} className="flex items-center justify-between p-3 border border-[var(--border)] rounded-lg">
              <div>
                <p className="font-medium text-[var(--foreground)]">{source.name}</p>
                {source.pipeline && <p className="text-sm text-[var(--muted)]">Воронка: {source.pipeline.name}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(source)} className="px-3 py-1 text-sm text-[var(--primary)] hover:bg-[var(--primary-soft)] rounded-lg transition-colors">Изменить</button>
                <button onClick={() => handleDelete(source.id)} className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">Удалить</button>
              </div>
            </div>
          ))
        )}
      </div>
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]" onClick={() => setIsModalOpen(false)}>
          <div className="bg-[var(--surface)] rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">{currentEditingSource ? 'Изменить источник' : 'Добавить источник'}</h2>
              <button onClick={() => { setIsModalOpen(false); setCurrentEditingSource(null); setCurrentFormData({ name: '', pipelineId: '' }); setError('') }} className="text-[var(--muted)] hover:text-[var(--foreground)] text-2xl leading-none">✕</button>
            </div>
            {error && <div className="mb-4 p-3 bg-[var(--error-soft)] border border-[var(--error)]/30 rounded-lg text-[var(--error)] text-sm">{error}</div>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Название *</label>
                <input type="text" value={currentFormData.name} onChange={(e) => setCurrentFormData({ ...currentFormData, name: e.target.value })} className="w-full p-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]" placeholder="Например: Авито, Сайт, Реклама" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Воронка (опционально)</label>
                <select value={currentFormData.pipelineId} onChange={(e) => setCurrentFormData({ ...currentFormData, pipelineId: e.target.value })} className="w-full p-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]">
                  <option value="">Не привязывать</option>
                  {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <p className="text-xs text-[var(--muted)] mt-1">При выборе источника сделка автоматически попадёт в эту воронку</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button type="button" onClick={() => { setIsModalOpen(false); setCurrentEditingSource(null); setCurrentFormData({ name: '', pipelineId: '' }); setError('') }} className="btn-secondary text-sm" disabled={saving}>Отмена</button>
              <button type="button" onClick={handleSave} disabled={saving} className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed">{saving ? 'Сохранение...' : 'Сохранить'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

function DealTypesManager({
  modalOpen: externalModalOpen,
  setModalOpen: setExternalModalOpen,
  editingType: externalEditingType,
  setEditingType: setExternalEditingType,
  formData: externalFormData,
  setFormData: setExternalFormData,
}: {
  modalOpen?: boolean
  setModalOpen?: (open: boolean) => void
  editingType?: {id: number, name: string} | null
  setEditingType?: (type: {id: number, name: string} | null) => void
  formData?: { name: string }
  setFormData?: (data: { name: string }) => void
}) {
  const [types, setTypes] = useState<Array<{id: number, name: string}>>([])
  const [loading, setLoading] = useState(true)
  const [internalModalOpen, setInternalModalOpen] = useState(false)
  const [internalEditingType, setInternalEditingType] = useState<{id: number, name: string} | null>(null)
  const [internalFormData, setInternalFormData] = useState({ name: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isModalOpen = externalModalOpen !== undefined ? externalModalOpen : internalModalOpen
  const setIsModalOpen = setExternalModalOpen || setInternalModalOpen
  const currentEditingType = externalEditingType !== undefined ? externalEditingType : internalEditingType
  const setCurrentEditingType = setExternalEditingType || setInternalEditingType
  const currentFormData = externalFormData || internalFormData
  const setCurrentFormData = setExternalFormData || setInternalFormData

  useEffect(() => { fetchTypes() }, [])

  const fetchTypes = async () => {
    try {
      const response = await fetch('/api/deal-types')
      if (response.ok) {
        const data = await response.json()
        setTypes(data || [])
      }
    } catch (err) {
      console.error('Error fetching types:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!currentFormData.name.trim()) { setError('Название обязательно'); return }
    setSaving(true)
    setError('')
    try {
      const url = '/api/deal-types'
      const method = currentEditingType ? 'PUT' : 'POST'
      const body = currentEditingType ? { id: currentEditingType.id, name: currentFormData.name } : { name: currentFormData.name }
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (response.ok) {
        await fetchTypes()
        setIsModalOpen(false)
        setCurrentEditingType(null)
        setCurrentFormData({ name: '' })
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Ошибка сохранения')
      }
    } catch {
      setError('Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот тип?')) return
    try {
      const response = await fetch(`/api/deal-types?id=${id}`, { method: 'DELETE' })
      if (response.ok) await fetchTypes()
    } catch (err) {
      console.error('Error deleting type:', err)
    }
  }

  const handleEdit = (type: {id: number, name: string}) => {
    setCurrentEditingType(type)
    setCurrentFormData({ name: type.name })
    setIsModalOpen(true)
  }

  if (loading) return <div className="text-center py-4 text-[var(--muted)]">Загрузка...</div>

  return (
    <>
      <div className="space-y-2">
        {types.length === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-4">Нет типов. Добавьте первый тип.</p>
        ) : (
          types.map((type) => (
            <div key={type.id} className="flex items-center justify-between p-3 border border-[var(--border)] rounded-lg">
              <p className="font-medium text-[var(--foreground)]">{type.name}</p>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(type)} className="px-3 py-1 text-sm text-[var(--primary)] hover:bg-[var(--primary-soft)] rounded-lg transition-colors">Изменить</button>
                <button onClick={() => handleDelete(type.id)} className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">Удалить</button>
              </div>
            </div>
          ))
        )}
      </div>
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]" onClick={() => setIsModalOpen(false)}>
          <div className="bg-[var(--surface)] rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">{currentEditingType ? 'Изменить тип' : 'Добавить тип'}</h2>
              <button onClick={() => { setIsModalOpen(false); setCurrentEditingType(null); setCurrentFormData({ name: '' }); setError('') }} className="text-[var(--muted)] hover:text-[var(--foreground)] text-2xl leading-none">✕</button>
            </div>
            {error && <div className="mb-4 p-3 bg-[var(--error-soft)] border border-[var(--error)]/30 rounded-lg text-[var(--error)] text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Название *</label>
              <input type="text" value={currentFormData.name} onChange={(e) => setCurrentFormData({ ...currentFormData, name: e.target.value })} className="w-full p-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]" placeholder="Например: Продажа, Монтаж, Консультация" />
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button type="button" onClick={() => { setIsModalOpen(false); setCurrentEditingType(null); setCurrentFormData({ name: '' }); setError('') }} className="btn-secondary text-sm" disabled={saving}>Отмена</button>
              <button type="button" onClick={handleSave} disabled={saving} className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed">{saving ? 'Сохранение...' : 'Сохранить'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
