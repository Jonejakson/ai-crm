'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import FilesManager from '@/components/FilesManager'
import TagsManager from '@/components/TagsManager'
import CustomFieldsEditor from '@/components/CustomFieldsEditor'
import Comments from '@/components/Comments'
import toast from 'react-hot-toast'
import { replaceTemplateVariables, type TemplateContext } from '@/lib/email-template-utils'
import { CustomSelect } from '@/components/CustomSelect'

interface Deal {
  id: number
  title: string
  amount: number
  currency: string
  stage: string
  probability: number
  expectedCloseDate: string | null
  externalId?: string | null
  syncedAt?: string | null
  createdAt: string
  updatedAt: string
  contact: {
    id: number
    name: string
    email: string
    phone: string | null
    company: string | null
    position?: string | null
  }
  source?: {
    id: number
    name: string
  } | null
  dealType?: {
    id: number
    name: string
  } | null
  user?: {
    id: number
    name: string
    email: string
  } | null
  pipeline?: {
    id: number
    name: string
  } | null
  moyskladItems?: Array<{
    id: number
    moyskladOrderId: string
    positionId: string
    assortmentId: string | null
    name: string
    quantity: number
    priceKopecks: number
    sumKopecks: number
    updatedAt: string
  }>
}

interface Task {
  id: number
  title: string
  description: string | null
  status: string
  dueDate: string | null
  createdAt: string
  user?: {
    id: number
    name: string
  } | null
}

interface ActivityLog {
  id: number
  entityType: string
  entityId: number
  action: string
  description: string | null
  metadata: any
  user: {
    id: number
    name: string
    email: string
  } | null
  createdAt: string
}

interface DealSource {
  id: number
  name: string
}

interface DealType {
  id: number
  name: string
}

interface Stage {
  name: string
}

export default function DealDetailPage() {
  const params = useParams()
  const router = useRouter()
  const dealId = params.id
  const { data: session } = useSession()

  const [deal, setDeal] = useState<Deal | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [emailTemplates, setEmailTemplates] = useState<Array<{ id: number; name: string; subject: string; body: string }>>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('')
  const [emailForm, setEmailForm] = useState({ subject: '', message: '' })
  const [emailSending, setEmailSending] = useState(false)
  const [emailAlert, setEmailAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [dealSources, setDealSources] = useState<DealSource[]>([])
  const [dealTypes, setDealTypes] = useState<DealType[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    dueTime: '',
    status: 'pending'
  })
  const [editFormData, setEditFormData] = useState({
    title: '',
    amount: '',
    currency: 'RUB',
    stage: '',
    sourceId: '',
    dealTypeId: '',
  })

  useEffect(() => {
    if (dealId) {
      fetchDealData()
      fetchDealSources()
      fetchDealTypes()
      fetchEmailTemplates()
      fetchStages()
    }
  }, [dealId])

  const fetchDealSources = async () => {
    try {
      const response = await fetch('/api/deal-sources')
      if (response.ok) {
        const data = await response.json()
        setDealSources(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching deal sources:', error)
    }
  }

  const fetchDealTypes = async () => {
    try {
      const response = await fetch('/api/deal-types')
      if (response.ok) {
        const data = await response.json()
        setDealTypes(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching deal types:', error)
    }
  }

  const fetchStages = async () => {
    try {
      const response = await fetch('/api/pipelines')
      if (response.ok) {
        const pipelines = await response.json()
        if (Array.isArray(pipelines) && pipelines.length > 0) {
          const defaultPipeline = pipelines.find((p: any) => p.isDefault) || pipelines[0]
          if (defaultPipeline?.stages) {
            try {
              const parsed = JSON.parse(defaultPipeline.stages)
              if (Array.isArray(parsed)) {
                const stageNames = parsed.map((s: any) => typeof s === 'string' ? s : s.name)
                setStages(stageNames.map((name: string) => ({ name })))
              }
            } catch {
              setStages([])
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching stages:', error)
    }
  }

  const fetchDealData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/deals/${dealId}`)
      if (response.ok) {
        const data = await response.json()
        setDeal(data)
        setEditFormData({
          title: data.title,
          amount: data.amount.toString(),
          currency: data.currency,
          stage: data.stage,
          sourceId: data.source?.id?.toString() || '',
          dealTypeId: data.dealType?.id?.toString() || '',
        })
        
        // Загружаем задачи по контакту сделки и активность только если сделка найдена
        if (data && data.contact?.id) {
          // Загружаем задачи по контакту сделки
          const tasksResponse = await fetch(`/api/tasks`)
          if (tasksResponse.ok) {
            const tasksData = await tasksResponse.json()
            // Фильтруем задачи по contactId
            const filteredTasks = Array.isArray(tasksData) 
              ? tasksData.filter((task: any) => task.contactId === data.contact.id)
              : []
            setTasks(filteredTasks)
          }
          
          // Загружаем активность
          try {
            const activityResponse = await fetch(`/api/activity?entityType=deal&entityId=${dealId}`)
            if (activityResponse.ok) {
              const activityData = await activityResponse.json()
              setActivityLogs(Array.isArray(activityData?.logs) ? activityData.logs : [])
            }
          } catch (error) {
            console.error('Error fetching activity:', error)
          }
        }
      } else {
        toast.error('Сделка не найдена')
        router.push('/deals')
      }
    } catch (error) {
      console.error('Error fetching deal data:', error)
      toast.error('Ошибка загрузки данных сделки')
    } finally {
      setLoading(false)
    }
  }

  const buildTaskDueDate = (date: string, time: string) => {
    if (!date) return null
    const t = time && time.trim() ? time.trim() : '00:00'
    const d = new Date(`${date}T${t}:00`)
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString()
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskFormData.title.trim() || !deal) return

    try {
      const dueDateValue = buildTaskDueDate(taskFormData.dueDate, taskFormData.dueTime)
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: taskFormData.title,
          description: taskFormData.description || '',
          contactId: deal.contact.id,
          dueDate: dueDateValue,
          status: taskFormData.status
        }),
      })

      if (response.ok) {
        setIsTaskModalOpen(false)
        setTaskFormData({ title: '', description: '', dueDate: '', dueTime: '', status: 'pending' })
        toast.success('Задача создана')
        fetchDealData()
      } else {
        const error = await response.json()
        toast.error(error.message || error.error || 'Ошибка создания задачи')
      }
    } catch (error) {
      console.error('Error creating task:', error)
      toast.error('Ошибка создания задачи')
    }
  }

  const handleUpdateTaskStatus = async (taskId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (response.ok) {
        toast.success('Статус задачи обновлен')
        // Обновляем локальное состояние задач сразу для мгновенной обратной связи
        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === taskId ? { ...task, status: newStatus } : task
          )
        )
        // Затем обновляем все данные
        fetchDealData()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка обновления задачи')
      }
    } catch (error) {
      console.error('Error updating task:', error)
      toast.error('Ошибка обновления задачи')
    }
  }

  const handleExportToMoysklad = async () => {
    if (!deal) return
    try {
      const response = await fetch('/api/accounting/moysklad/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id }),
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(data.message || 'Выгружено в МойСклад')
        fetchDealData()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при выгрузке в МойСклад')
      }
    } catch (error) {
      console.error('Error exporting to Moysklad:', error)
      toast.error('Ошибка при выгрузке в МойСклад')
    }
  }

  const handleSyncMoysklad = async () => {
    if (!deal) return
    try {
      const response = await fetch('/api/accounting/moysklad/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, mode: 'sync' }),
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(data.message || 'Синхронизировано с МойСклад')
        fetchDealData()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при синхронизации с МойСклад')
      }
    } catch (error) {
      console.error('Error syncing with Moysklad:', error)
      toast.error('Ошибка при синхронизации с МойСклад')
    }
  }

  const handleDownloadInvoice = async () => {
    if (!deal) return
    try {
      const res = await fetch(`/api/deals/${deal.id}/invoice`, {
        method: 'GET',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Не удалось сформировать PDF')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${deal.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF счет сформирован')
    } catch (e) {
      console.error(e)
      toast.error('Ошибка при формировании счета')
    }
  }

  const handleSendInvoice = async () => {
    if (!deal) return
    const email = deal.contact?.email
    if (!email) {
      toast.error('У контакта нет email')
      return
    }
    try {
      const res = await fetch(`/api/deals/${deal.id}/invoice?sendEmail=1&email=${encodeURIComponent(email)}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Не удалось отправить счет')
        return
      }
      const data = await res.json()
      toast.success(data.message || 'Счет отправлен')
    } catch (e) {
      console.error(e)
      toast.error('Ошибка при отправке счета')
    }
  }

  const handleExportTo1C = async () => {
    if (!deal) return
    try {
      const response = await fetch('/api/accounting/one-c/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id }),
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(data.message || 'Выгружено в 1С')
        fetchDealData()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при выгрузке в 1С')
      }
    } catch (error) {
      console.error('Error exporting to 1C:', error)
      toast.error('Ошибка при выгрузке в 1С')
    }
  }

  const fetchEmailTemplates = async () => {
    try {
      const response = await fetch('/api/email-templates')
      if (response.ok) {
        const data = await response.json()
        setEmailTemplates(data)
      }
    } catch (error) {
      console.error('Error fetching email templates:', error)
    }
  }

  const handleTemplateSelect = (templateId: number | '') => {
    setSelectedTemplateId(templateId)
    if (templateId && deal) {
      const template = emailTemplates.find(t => t.id === templateId)
      if (template) {
        const context: TemplateContext = {
          contact: {
            name: deal.contact.name,
            email: deal.contact.email,
            phone: deal.contact.phone,
            company: deal.contact.company,
            position: deal.contact.position,
          },
          deal: {
            title: deal.title,
            amount: deal.amount,
            currency: deal.currency,
            stage: deal.stage,
            probability: deal.probability,
          },
          manager: deal.user ? {
            name: deal.user.name,
            email: deal.user.email,
          } : undefined,
        }
        setEmailForm({
          subject: replaceTemplateVariables(template.subject, context),
          message: replaceTemplateVariables(template.body, context),
        })
      }
    }
  }

  const openEmailModal = () => {
    setEmailAlert(null)
    setSelectedTemplateId('')
    setEmailForm({ subject: '', message: '' })
    setIsEmailModalOpen(true)
  }

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailForm.subject.trim() || !emailForm.message.trim() || !deal) {
      setEmailAlert({ type: 'error', message: 'Заполните тему и текст письма' })
      return
    }

    if (!deal.contact.email) {
      setEmailAlert({ type: 'error', message: 'У контакта нет email' })
      return
    }

    setEmailSending(true)
    setEmailAlert(null)

    try {
      const response = await fetch('/api/integrations/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: deal.contact.id,
          subject: emailForm.subject,
          message: emailForm.message,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Не удалось отправить письмо')
      }

      setEmailAlert({ type: 'success', message: 'Письмо отправлено' })
      setEmailForm({ subject: '', message: '' })
      setIsEmailModalOpen(false)
      fetchDealData()
    } catch (error: any) {
      setEmailAlert({ type: 'error', message: error.message || 'Ошибка отправки письма' })
    } finally {
      setEmailSending(false)
    }
  }

  const handleUpdateDeal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deal) return

    try {
      const response = await fetch('/api/deals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: deal.id,
          title: editFormData.title,
          amount: parseFloat(editFormData.amount) || 0,
          currency: editFormData.currency,
          stage: editFormData.stage,
          sourceId: editFormData.sourceId ? parseInt(editFormData.sourceId) : null,
          dealTypeId: editFormData.dealTypeId ? parseInt(editFormData.dealTypeId) : null,
        }),
      })

      if (response.ok) {
        toast.success('Сделка обновлена')
        setIsEditModalOpen(false)
        fetchDealData()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка обновления сделки')
      }
    } catch (error) {
      console.error('Error updating deal:', error)
      toast.error('Ошибка обновления сделки')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
          <p className="text-[var(--muted)]">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (!deal) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-[var(--muted)] mb-4">Сделка не найдена</p>
          <Link href="/deals" className="btn-primary">
            Вернуться к сделкам
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Шапка */}
      <div className="bg-[var(--surface)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="space-y-3">
            {/* Название сделки на всю ширину */}
            <div>
              <h1 className="text-2xl font-bold text-[var(--foreground)]">{deal.title}</h1>
              <p className="text-sm text-[var(--muted)]">
                {deal.amount.toLocaleString('ru-RU')} {deal.currency} • {deal.stage}
              </p>
            </div>
            
            {/* Кнопки: Назад и Редактировать на одном уровне (мобильная версия) */}
            <div className="flex items-center justify-between md:hidden">
              <Link href="/deals" className="text-[var(--muted)] hover:text-[var(--foreground)] text-sm">
                ← Назад к сделкам
              </Link>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="btn-primary text-xs px-3 py-1.5"
              >
                Редактировать
              </button>
            </div>
            
            {/* Кнопки на десктопе: все в одну строку */}
            <div className="hidden md:flex items-center gap-3">
              <Link href="/deals" className="text-[var(--muted)] hover:text-[var(--foreground)] text-sm">
                ← Назад к сделкам
              </Link>
              <button
                onClick={handleExportToMoysklad}
                disabled={!!deal.externalId}
                className="btn-secondary text-sm"
                title={deal.externalId ? 'Уже выгружено в МойСклад' : 'Выгрузить контакт и заказ в МойСклад'}
              >
                {deal.externalId ? '✓ Выгружено в МойСклад' : 'Выгрузить в МойСклад'}
              </button>
              <button
                onClick={handleExportTo1C}
                className="btn-secondary text-sm"
                title="Выгрузить контакт и заказ в 1С"
              >
                Выгрузить в 1С
              </button>
              <button
                onClick={handleSyncMoysklad}
                className="btn-secondary text-sm"
                title="Обновить/синхронизировать заказ из МойСклад"
              >
                Обновить из МойСклад
              </button>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="btn-primary text-sm"
              >
                Редактировать
              </button>
              <button
                onClick={handleDownloadInvoice}
                className="btn-secondary text-sm"
                title="Скачать счет (PDF)"
              >
                Счет (PDF)
              </button>
              <button
                onClick={handleSendInvoice}
                className="btn-secondary text-sm"
                title="Отправить счет на email контакта"
              >
                Отправить счет
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Основной контент - двухколоночный layout */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Левая колонка - Информация о клиенте */}
          <div className="lg:col-span-1 space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Клиент</h2>
              <div className="space-y-4">
                <div>
                  <Link 
                    href={`/contacts/${deal.contact.id}`}
                    className="text-xl font-semibold text-[var(--primary)] hover:underline"
                  >
                    {deal.contact.name}
                  </Link>
                </div>
                {deal.contact.email && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Email</label>
                      <p className="text-[var(--foreground)]">{deal.contact.email}</p>
                    </div>
                    <button
                      onClick={openEmailModal}
                      className="w-full btn-secondary text-sm"
                    >
                      ✉️ Отправить письмо
                    </button>
                  </>
                )}
                {deal.contact.phone && (
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Телефон</label>
                    <p className="text-[var(--foreground)]">{deal.contact.phone}</p>
                  </div>
                )}
                {deal.contact.company && (
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Компания</label>
                    <p className="text-[var(--foreground)]">{deal.contact.company}</p>
                  </div>
                )}
                {deal.contact.position && (
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Должность</label>
                    <p className="text-[var(--foreground)]">{deal.contact.position}</p>
                  </div>
                )}
              </div>
            </div>

            {deal.externalId && (
              <div className="card">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 className="text-lg font-semibold">МойСклад: позиции заказа</h2>
                  <button onClick={handleSyncMoysklad} className="btn-secondary text-sm">
                    Обновить
                  </button>
                </div>
                {!deal.moyskladItems || deal.moyskladItems.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    Позиции не загружены. Нажми «Обновить из МойСклад», чтобы подтянуть состав заказа.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-3 text-xs uppercase tracking-wide text-[var(--muted)]">
                      <div>Номенклатура</div>
                      <div className="text-right">Кол-во</div>
                      <div className="text-right">Сумма</div>
                    </div>
                    {deal.moyskladItems.map((it) => (
                      <div
                        key={it.id}
                        className="grid grid-cols-[1fr_auto_auto] gap-3 border-t border-[var(--border)] pt-2 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[var(--foreground)]">{it.name}</div>
                          {it.assortmentId && (
                            <div className="text-xs text-[var(--muted)] truncate">ID: {it.assortmentId}</div>
                          )}
                        </div>
                        <div className="text-right tabular-nums">{Number(it.quantity).toLocaleString('ru-RU')}</div>
                        <div className="text-right tabular-nums">
                          {Math.round((it.sumKopecks || 0) / 100).toLocaleString('ru-RU')} {deal.currency}
                        </div>
                      </div>
                    ))}
                    <div className="border-t border-[var(--border)] pt-2 flex items-center justify-between text-sm">
                      <span className="text-[var(--muted)]">Итого</span>
                      <span className="font-semibold tabular-nums">
                        {Math.round(
                          (deal.moyskladItems.reduce((acc, it) => acc + (it.sumKopecks || 0), 0) || 0) / 100
                        ).toLocaleString('ru-RU')}{' '}
                        {deal.currency}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Информация о сделке</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Сумма</label>
                  <p className="text-lg font-semibold text-[var(--foreground)]">
                    {deal.amount.toLocaleString('ru-RU')} {deal.currency}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Этап</label>
                  <p className="text-[var(--foreground)]">{deal.stage}</p>
                </div>
                {deal.source && (
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Источник</label>
                    <p className="text-[var(--foreground)]">{deal.source.name}</p>
                  </div>
                )}
                {deal.dealType && (
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Тип сделки</label>
                    <p className="text-[var(--foreground)]">{deal.dealType.name}</p>
                  </div>
                )}
                {deal.user && (
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Ответственный</label>
                    <p className="text-[var(--foreground)]">{deal.user.name}</p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Вероятность</label>
                  <p className="text-[var(--foreground)]">{deal.probability}%</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Создана</label>
                  <p className="text-[var(--foreground)]">
                    {new Date(deal.createdAt).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Теги</h2>
              <TagsManager
                entityType="deal"
                entityId={deal.id}
              />
            </div>
          </div>

          {/* Правая колонка - Задачи, файлы, комментарии */}
          <div className="lg:col-span-2 space-y-6">
            {/* Задачи */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Задачи</h2>
              <div className="space-y-3">
                {tasks.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Нет задач</p>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-4 border border-[var(--border)] rounded-lg hover:bg-[var(--background-soft)] transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={task.status === 'completed'}
                              onChange={(e) => {
                                handleUpdateTaskStatus(task.id, e.target.checked ? 'completed' : 'pending')
                              }}
                              className="w-4 h-4"
                            />
                            <h3 className={`font-medium ${task.status === 'completed' ? 'line-through text-[var(--muted)]' : 'text-[var(--foreground)]'}`}>
                              {task.title}
                            </h3>
                          </div>
                          {task.description && (
                            <p className="text-sm text-[var(--muted)] mb-2">{task.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
                            {task.dueDate && (
                              <span>
                                {new Date(task.dueDate).toLocaleString('ru-RU', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                            {task.user && (
                              <span>{task.user.name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {/* Кнопка создания задачи внизу по центру на 70% ширины */}
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => setIsTaskModalOpen(true)}
                  className="btn-primary text-sm"
                  style={{ width: '70%' }}
                >
                  + Создать задачу
                </button>
              </div>
            </div>

            {/* Комментарии */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Комментарии</h2>
              <Comments
                entityType="deal"
                entityId={deal.id}
              />
            </div>

            {/* Файлы */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Файлы</h2>
              <FilesManager
                entityType="deal"
                entityId={deal.id}
              />
            </div>

            {/* Дополнительные поля */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Дополнительные поля</h2>
              <CustomFieldsEditor
                entityType="deal"
                entityId={deal.id}
              />
            </div>

            {/* История активности */}
            {activityLogs.length > 0 && (
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">История активности</h2>
                <div className="space-y-3">
                  {activityLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 border-l-2 border-[var(--primary-soft)] bg-[var(--background-soft)] rounded"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-[var(--foreground)]">{log.description || log.action}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted)]">
                            {log.user && <span>{log.user.name}</span>}
                            <span>•</span>
                            <span>{new Date(log.createdAt).toLocaleString('ru-RU')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Модальное окно редактирования сделки */}
      {isEditModalOpen && deal && (
        <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div className="modal-content max-w-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header flex-shrink-0">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)] font-semibold mb-1">
                  Редактирование сделки
                </p>
                <h3 className="text-2xl font-bold text-[var(--foreground)]">
                  Редактировать сделку
                </h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-2 hover:bg-[var(--background-soft)] rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateDeal} className="flex flex-col flex-1 min-h-0">
              <div className="modal-body flex-1 overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Название сделки *
                    </label>
                    <input
                      type="text"
                      value={editFormData.title}
                      onChange={(e) => setEditFormData({...editFormData, title: e.target.value})}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        Сумма
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editFormData.amount}
                        onChange={(e) => setEditFormData({...editFormData, amount: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        Валюта
                      </label>
                      <CustomSelect
                        value={editFormData.currency}
                        onChange={(value) => setEditFormData({...editFormData, currency: value})}
                        options={[
                          { value: 'RUB', label: 'RUB' },
                          { value: 'USD', label: 'USD' },
                          { value: 'EUR', label: 'EUR' },
                        ]}
                        placeholder="Выберите валюту"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        Источник сделки
                      </label>
                      <CustomSelect
                        value={editFormData.sourceId}
                        onChange={(value) => setEditFormData({...editFormData, sourceId: value})}
                        options={[
                          { value: '', label: 'Выберите источник' },
                          ...dealSources.map(source => ({
                            value: source.id.toString(),
                            label: source.name
                          }))
                        ]}
                        placeholder="Выберите источник"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        Тип сделки
                      </label>
                      <CustomSelect
                        value={editFormData.dealTypeId}
                        onChange={(value) => setEditFormData({...editFormData, dealTypeId: value})}
                        options={[
                          { value: '', label: 'Выберите тип' },
                          ...dealTypes.map(type => ({
                            value: type.id.toString(),
                            label: type.name
                          }))
                        ]}
                        placeholder="Выберите тип"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Этап *
                    </label>
                    <CustomSelect
                      value={editFormData.stage}
                      onChange={(value) => setEditFormData({...editFormData, stage: value})}
                      options={[
                        { value: '', label: 'Выберите этап' },
                        ...stages.map(stage => ({
                          value: stage.name,
                          label: stage.name
                        }))
                      ]}
                      placeholder="Выберите этап"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn-secondary text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn-primary text-sm btn-ripple"
                >
                  Сохранить изменения
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно создания задачи */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6 border-b">
              <h3 className="text-xl font-semibold">Создать задачу</h3>
            </div>
            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Название *
                </label>
                <input
                  type="text"
                  value={taskFormData.title}
                  onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                  required
                  className="w-full"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Описание
                </label>
                <textarea
                  value={taskFormData.description}
                  onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                  rows={3}
                  className="w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Дата
                  </label>
                  <input
                    type="date"
                    value={taskFormData.dueDate}
                    onChange={(e) => setTaskFormData({ ...taskFormData, dueDate: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Время
                  </label>
                  <input
                    type="time"
                    value={taskFormData.dueTime}
                    onChange={(e) => setTaskFormData({ ...taskFormData, dueTime: e.target.value })}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="btn-secondary"
                >
                  Отмена
                </button>
                <button type="submit" className="btn-primary">
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно отправки письма */}
      {isEmailModalOpen && deal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Почта</p>
                <h3 className="text-lg font-semibold">Отправить письмо</h3>
              </div>
              <button
                onClick={() => setIsEmailModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {emailAlert && (
              <div
                className={`mb-4 rounded-2xl px-4 py-2 text-sm ${
                  emailAlert.type === 'success'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {emailAlert.message}
              </div>
            )}

            <form onSubmit={handleSendEmail} className="space-y-4">
              {emailTemplates.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 mb-2">
                    Шаблон (опционально)
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleTemplateSelect(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
                  >
                    <option value="">Выберите шаблон...</option>
                    {emailTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 mb-2">
                  Тема
                </label>
                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm((prev) => ({ ...prev, subject: e.target.value }))}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 mb-2">
                  Сообщение
                </label>
                <textarea
                  rows={6}
                  value={emailForm.message}
                  onChange={(e) => setEmailForm((prev) => ({ ...prev, message: e.target.value }))}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(false)}
                  className="btn-secondary text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={emailSending}
                  className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {emailSending ? 'Отправка…' : 'Отправить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

