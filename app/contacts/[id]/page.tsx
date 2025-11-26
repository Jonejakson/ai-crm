'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import FilesManager from '@/components/FilesManager'
import TagsManager from '@/components/TagsManager'
import CustomFieldsEditor from '@/components/CustomFieldsEditor'

interface Contact {
  id: number
  name: string
  email: string
  phone: string | null
  company: string | null
  position?: string | null
  department?: string | null
  inn?: string | null
  kpp?: string | null
  ogrn?: string | null
  leadSource?: string | null
  user?: {
    id: number
    name: string
    email: string
  } | null
  createdAt: string
}

interface Task {
  id: number
  title: string
  description: string | null
  status: string
  dueDate: string | null
  createdAt: string
}

interface Dialog {
  id: number
  message: string
  sender: string
  platform?: 'TELEGRAM' | 'WHATSAPP' | 'INTERNAL'
  externalId?: string | null
  createdAt: string
}

interface Deal {
  id: number
  title: string
  amount: number
  currency: string
  stage: string
  probability: number
  expectedCloseDate: string | null
  source?: {
    id: number
    name: string
  } | null
  createdAt: string
}

interface EmailLog {
  id: number
  subject: string
  body: string
  status: string
  error: string | null
  toEmail: string
  createdAt: string
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

interface ManagerUser {
  id: number
  name: string
  email: string
  role: string
}

export default function ContactDetailPage() {
  const params = useParams()
  const contactId = params.id
  const { data: session } = useSession()

  const [contact, setContact] = useState<Contact | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [dialogs, setDialogs] = useState<Dialog[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [companyDetails, setCompanyDetails] = useState<null | {
    inn?: string
    kpp?: string
    ogrn?: string
    address?: string
    management?: string
  }>(null)
  const [companyDetailsLoading, setCompanyDetailsLoading] = useState(false)
  const [companyDetailsError, setCompanyDetailsError] = useState('')
  // Убрали вкладки - все в одной прокручиваемой странице
  const [newMessage, setNewMessage] = useState('')
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [emailForm, setEmailForm] = useState({ subject: '', message: '' })
  const [emailSending, setEmailSending] = useState(false)
  const [emailAlert, setEmailAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    dueTime: ''
  })
  const [managerModalOpen, setManagerModalOpen] = useState(false)
  const [managerOptions, setManagerOptions] = useState<ManagerUser[]>([])
  const [managersLoading, setManagersLoading] = useState(false)
  const [selectedManagerId, setSelectedManagerId] = useState<number | null>(null)
  const [reassignState, setReassignState] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [reassignModalAlert, setReassignModalAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [reassignSubmitting, setReassignSubmitting] = useState(false)

  const isAdmin = session?.user?.role === 'admin'

  useEffect(() => {
    if (contactId) {
      fetchContactData()
    }
  }, [contactId])

  useEffect(() => {
    if (contact?.inn) {
      fetchCompanyDetails(contact.inn)
    } else {
      setCompanyDetails(null)
      setCompanyDetailsError('')
    }
  }, [contact?.inn])

  const fetchContactData = async () => {
    try {
      const [contactRes, tasksRes, dialogsRes, dealsRes, emailsRes, activityRes] = await Promise.all([
        fetch(`/api/contacts`).then(res => res.json()),
        fetch(`/api/tasks`).then(res => res.json()),
        fetch(`/api/dialogs?contactId=${contactId}`).then(res => res.json()),
        fetch(`/api/deals`).then(res => res.json()),
        fetch(`/api/integrations/email/logs?contactId=${contactId}`).then(res => (res.ok ? res.json() : { logs: [] })),
        fetch(`/api/activity?entityType=contact&entityId=${contactId}`).then(res => (res.ok ? res.json() : { logs: [] }))
      ])

      const foundContact = Array.isArray(contactRes) 
        ? contactRes.find((c: Contact) => c.id === Number(contactId))
        : contactRes
      setContact(foundContact || null)
      
      // Фильтруем задачи этого контакта
      const contactTasks = tasksRes.filter((task: Task & { contactId: number }) => 
        task.contactId === Number(contactId)
      )
      setTasks(contactTasks)

      // Фильтруем сделки этого контакта
      const contactDeals = dealsRes.filter((deal: Deal & { contactId: number }) => 
        deal.contactId === Number(contactId)
      )
      setDeals(contactDeals)

      setDialogs(Array.isArray(dialogsRes) ? dialogsRes : [])
      setEmailLogs(Array.isArray(emailsRes.logs) ? emailsRes.logs : [])
      setActivityLogs(Array.isArray(activityRes.logs) ? activityRes.logs : [])
    } catch (error) {
      console.error('Error fetching contact data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCompanyDetails = async (inn: string) => {
    setCompanyDetailsLoading(true)
    setCompanyDetailsError('')
    try {
      const response = await fetch(`/api/company/by-inn?inn=${inn}`)
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setCompanyDetails(null)
        setCompanyDetailsError(
          data?.error || 'Не удалось загрузить данные компании по ИНН'
        )
        return
      }

      setCompanyDetails(data)
    } catch (error) {
      console.error('Error fetching company details:', error)
      setCompanyDetailsError('Ошибка при загрузке данных компании')
      setCompanyDetails(null)
    } finally {
      setCompanyDetailsLoading(false)
    }
  }

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailForm.subject.trim() || !emailForm.message.trim()) {
      setEmailAlert({ type: 'error', message: 'Заполните тему и текст письма' })
      return
    }

    setEmailSending(true)
    setEmailAlert(null)

    try {
      const response = await fetch('/api/integrations/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: Number(contactId),
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
      await fetchContactData()
      setIsEmailModalOpen(false)
    } catch (error: any) {
      setEmailAlert({ type: 'error', message: error.message || 'Ошибка отправки письма' })
    } finally {
      setEmailSending(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    try {
      const response = await fetch('/api/dialogs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: newMessage,
          contactId: Number(contactId),
          sender: 'user'
        }),
      })

      if (response.ok) {
        setNewMessage('')
        fetchContactData() // Обновляем диалоги
      }
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const buildContactTaskDueDate = (date: string, time: string) => {
    if (!date) return null
    if (!time) return date
    return `${date}T${time}`
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskFormData.title.trim()) return

    try {
      const dueDateValue = buildContactTaskDueDate(taskFormData.dueDate, taskFormData.dueTime)
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: taskFormData.title,
          description: taskFormData.description || '',
          contactId: Number(contactId),
          dueDate: dueDateValue,
          status: 'pending'
        }),
      })

      if (response.ok) {
        setIsTaskModalOpen(false)
        setTaskFormData({ title: '', description: '', dueDate: '', dueTime: '' })
        fetchContactData() // Обновляем задачи
      }
    } catch (error) {
      console.error('Error creating task:', error)
    }
  }

  const openEmailModal = () => {
    setEmailAlert(null)
    setIsEmailModalOpen(true)
  }

  const fetchManagers = async () => {
    if (!isAdmin) return
    setManagersLoading(true)
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setManagerOptions(Array.isArray(data.users) ? data.users : [])
      } else {
        setReassignModalAlert({
          type: 'error',
          message: 'Не удалось загрузить список пользователей',
        })
      }
    } catch (error) {
      console.error('Error fetching managers list:', error)
      setReassignModalAlert({
        type: 'error',
        message: 'Ошибка при загрузке списка пользователей',
      })
    } finally {
      setManagersLoading(false)
    }
  }

  const openManagerModal = () => {
    if (!isAdmin || !contact) return
    setReassignModalAlert(null)
    setSelectedManagerId(contact.user?.id ?? null)
    setManagerModalOpen(true)
    if (!managerOptions.length) {
      fetchManagers()
    }
  }

  const closeManagerModal = () => {
    setManagerModalOpen(false)
    setReassignModalAlert(null)
    setReassignSubmitting(false)
  }

  const handleReassignManager = async () => {
    if (!contact) return
    if (!selectedManagerId || selectedManagerId === contact.user?.id) {
      setReassignModalAlert({ type: 'error', message: 'Выберите другого пользователя' })
      return
    }
    setReassignSubmitting(true)
    setReassignModalAlert(null)
    try {
      const response = await fetch('/api/contacts/reassign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contactId: contact.id,
          targetUserId: selectedManagerId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || 'Не удалось сменить ответственного')
      }

      await fetchContactData()
      closeManagerModal()
      setReassignState({
        type: 'success',
        message: `Ответственный менеджер изменён на ${data?.targetUser?.name || 'нового пользователя'}. Перенесено задач: ${data?.tasksUpdated ?? 0}, сделок: ${data?.dealsUpdated ?? 0}, событий: ${data?.eventsUpdated ?? 0}.`,
      })
    } catch (error: any) {
      console.error('Error reassigning manager:', error)
      setReassignModalAlert({ type: 'error', message: error?.message || 'Ошибка при смене ответственного' })
    } finally {
      setReassignSubmitting(false)
    }
  }

  const managerSelectValue = selectedManagerId ?? ''

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Загрузка...</div>
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-red-600">Контакт не найден</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {reassignState && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            reassignState.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {reassignState.message}
        </div>
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/contacts" className="text-[var(--primary)] hover:underline">
            ← Назад к контактам
          </Link>
          <h1 className="text-3xl font-semibold text-slate-900">{contact.name}</h1>
        </div>
        <div className="flex gap-3 flex-wrap">
          {contact.email && (
            <button
              onClick={openEmailModal}
              className="btn-secondary"
            >
              ✉️ Отправить письмо
            </button>
          )}
          <button
            onClick={() => setIsTaskModalOpen(true)}
            className="btn-primary"
          >
            + Добавить задачу
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="glass-panel rounded-3xl p-6 xl:col-span-2 space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Профиль</p>
            <h2 className="text-2xl font-semibold text-slate-900 mt-1">Контактная информация</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {[
              { label: 'Email', value: contact.email },
              { label: 'Телефон', value: contact.phone || 'Не указан' },
              { label: 'Компания', value: contact.company || 'Не указана' },
              { label: 'Дата добавления', value: new Date(contact.createdAt).toLocaleDateString('ru-RU') },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{item.label}</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Реквизиты и статус</p>
                <h3 className="text-lg font-semibold text-slate-900 mt-1">Компания и контакт</h3>
              </div>
              {companyDetailsLoading && (
                <span className="text-xs text-slate-400">Загрузка реквизитов...</span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { label: 'ИНН', value: contact.inn || 'Не указан' },
                { label: 'КПП', value: companyDetails?.kpp || 'Не указано' },
                { label: 'ОГРН', value: companyDetails?.ogrn || 'Не указано' },
                { label: 'Должность', value: contact.position || 'Не указана' },
                { label: 'Отдел', value: contact.department || 'Не указан' },
                { 
                  label: 'Ответственный менеджер', 
                  value: contact.user?.name || 'Не назначен',
                  hint: contact.user?.email
                },
                { 
                  label: 'Источник лида', 
                  value: contact.leadSource || deals.find((deal) => deal.source)?.source?.name || 'Не указан' 
                },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{item.value}</p>
                  {item.hint && <p className="text-xs text-slate-500 mt-1">{item.hint}</p>}
                  {item.label === 'Ответственный менеджер' && isAdmin && (
                    <button
                      onClick={openManagerModal}
                      className="mt-2 text-xs font-medium text-[var(--primary)] hover:underline"
                    >
                      Сменить ответственного
                    </button>
                  )}
                </div>
              ))}
            </div>
            {companyDetailsError && (
              <p className="text-xs text-red-500">{companyDetailsError}</p>
            )}
          </div>

        </div>

        {managerModalOpen && isAdmin && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">Смена ответственного менеджера</h3>
                <button
                  onClick={closeManagerModal}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Закрыть"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-slate-500">
                Выберите пользователя, которому передать контакт. Связанные задачи, сделки и события будут
                переназначены автоматически.
              </p>
              {reassignModalAlert && (
                <div
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    reassignModalAlert.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-red-200 bg-red-50 text-red-800'
                  }`}
                >
                  {reassignModalAlert.message}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">Новый ответственный</label>
                {managersLoading ? (
                  <div className="text-sm text-slate-500">Загрузка списка пользователей...</div>
                ) : (
                  <select
                    value={managerSelectValue}
                    onChange={(e) => setSelectedManagerId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  >
                    <option value="">Выберите пользователя</option>
                    {managerOptions.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.name}{' '}
                        {manager.role === 'admin' ? '(Админ)' : manager.role === 'manager' ? '(Менеджер)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={closeManagerModal}
                  className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
                >
                  Отмена
                </button>
                <button
                  onClick={handleReassignManager}
                  disabled={reassignSubmitting || !selectedManagerId || selectedManagerId === contact.user?.id}
                  className="btn-primary text-sm disabled:opacity-60"
                >
                  {reassignSubmitting ? 'Перенос...' : 'Переназначить'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="glass-panel rounded-3xl p-6 space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Статистика</p>
            <h2 className="text-xl font-semibold text-slate-900 mt-1">Сводка по активности</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Всего задач', value: tasks.length },
              { label: 'Активные задачи', value: tasks.filter(t => t.status === 'pending').length, accent: 'text-orange-500' },
              { label: 'Завершенные задачи', value: tasks.filter(t => t.status === 'completed').length, accent: 'text-emerald-500' },
              { label: 'Сообщений', value: dialogs.length },
              { label: 'Сделок', value: deals.length },
              { label: 'Сумма сделок', value: `${deals.reduce((sum, d) => sum + d.amount, 0).toLocaleString('ru-RU')} ₽`, accent: 'text-emerald-600' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm">
                <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">{stat.label}</p>
                <p className={`mt-2 text-lg font-semibold ${stat.accent || 'text-slate-900'}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Сделки</p>
              <div className="mt-3 space-y-3">
                {deals.length === 0 ? (
                  <p className="text-sm text-slate-500">Нет сделок</p>
                ) : (
                  deals.map((deal) => (
                    <div key={deal.id} className="rounded-2xl border border-white/60 bg-white/90 p-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{deal.title}</p>
                          <p className="text-xs text-slate-500">
                            {deal.amount.toLocaleString('ru-RU')} {deal.currency} • {deal.stage}
                          </p>
                        </div>
                        <span className="text-xs text-slate-400">
                          {deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString('ru-RU') : ''}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.35ем] text-slate-400">Задачи</p>
              <div className="mt-3 space-y-3">
                {tasks.length === 0 ? (
                  <p className="text-sm text-slate-500">Нет задач</p>
                ) : (
                  tasks.map((task) => (
                    <div key={task.id} className="rounded-2xl border border-white/60 bg-white/90 p-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                          <p className="text-xs text-slate-500">
                            Статус: {task.status}{task.dueDate ? ` • до ${new Date(task.dueDate).toLocaleDateString('ru-RU')}` : ''}
                          </p>
                        </div>
                        <span className="text-xs text-slate-400">
                          {new Date(task.createdAt).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Упрощенная версия - все в одной прокручиваемой области */}
      <div className="glass-panel rounded-3xl">
        <div className="p-6 space-y-8">
          {/* Активность */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Активность ({activityLogs.length})</h3>
            {activityLogs.length === 0 ? (
              <p className="text-slate-500">Нет записей активности</p>
            ) : (
              <div className="space-y-3">
                {activityLogs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-white/60 bg-white/90 p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-slate-900">{log.action}</span>
                          {log.user && (
                            <span className="text-xs text-slate-500">• {log.user.name}</span>
                          )}
                        </div>
                        {log.description && (
                          <p className="text-sm text-slate-700 mb-2">{log.description}</p>
                        )}
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div className="text-xs text-slate-500">
                            {JSON.stringify(log.metadata, null, 2)}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap ml-4">
                        {new Date(log.createdAt).toLocaleString('ru-RU')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Диалог */}
          <div className="border-t pt-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Диалог ({dialogs.length})</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
              {dialogs.length === 0 ? (
                <p className="text-slate-500">Нет сообщений</p>
              ) : (
                dialogs.map((dialog) => (
                  <div
                    key={dialog.id}
                    className={`p-3 rounded-lg ${
                      dialog.sender === 'user'
                        ? 'bg-[var(--primary-soft)]/70 ml-8'
                        : 'bg-white/80 mr-8'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-gray-900 text-sm">{dialog.message}</p>
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                        {new Date(dialog.createdAt).toLocaleTimeString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                      <span>{dialog.sender === 'user' ? 'Вы' : 'Клиент'}</span>
                      {dialog.platform && dialog.platform !== 'INTERNAL' && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          dialog.platform === 'TELEGRAM' 
                            ? 'bg-blue-100 text-blue-700' 
                            : dialog.platform === 'WHATSAPP'
                            ? 'bg-green-100 text-green-700'
                            : ''
                        }`}>
                          {dialog.platform === 'TELEGRAM' ? '📱 Telegram' : dialog.platform === 'WHATSAPP' ? '💬 WhatsApp' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleSendMessage} className="flex space-x-3">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Введите сообщение..."
                className="flex-1 rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
              />
              <button type="submit" className="btn-primary text-sm">
                Отправить
              </button>
            </form>
          </div>

          {/* Письма */}
          <div className="border-t pt-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Письма ({emailLogs.length})</h3>
              {contact.email && (
                <button className="btn-primary text-sm" onClick={openEmailModal}>
                  Написать письмо
                </button>
              )}
            </div>
            {!contact.email ? (
              <p className="text-sm text-red-500">У контакта нет email. Добавьте адрес, чтобы отправлять письма.</p>
            ) : emailLogs.length === 0 ? (
              <p className="text-slate-500">Писем пока не было</p>
            ) : (
              <div className="space-y-3">
                {emailLogs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-white/60 bg-white/90 p-4 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{log.subject}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(log.createdAt).toLocaleString('ru-RU')}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full ${
                          log.status === 'sent'
                            ? 'bg-emerald-100 text-emerald-700'
                            : log.status === 'failed'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {log.status === 'sent' ? 'Отправлено' : log.status === 'failed' ? 'Ошибка' : 'В очереди'}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">{log.body}</p>
                    {log.error && (
                      <p className="mt-2 text-xs text-red-500">Ошибка: {log.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Файлы */}
          {contact && (
            <div className="border-t pt-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Файлы</h3>
              <FilesManager
                entityType="contact"
                entityId={contact.id}
              />
            </div>
          )}

          {/* Теги */}
          {contact && (
            <div className="border-t pt-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Теги</h3>
              <TagsManager
                entityType="contact"
                entityId={contact.id}
                onTagsChange={fetchContactData}
              />
            </div>
          )}

          {/* Кастомные поля */}
          {contact && (
            <div className="border-t pt-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Дополнительные поля</h3>
              <CustomFieldsEditor
                entityType="contact"
                entityId={contact.id}
                onSave={fetchContactData}
              />
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно создания задачи */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Новая задача</h3>
              <button
                onClick={() => {
                  setIsTaskModalOpen(false)
                  setTaskFormData({ title: '', description: '', dueDate: '', dueTime: '' })
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название задачи *
                </label>
                <input
                  type="text"
                  value={taskFormData.title}
                  onChange={(e) => setTaskFormData({...taskFormData, title: e.target.value})}
                  required
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
                  placeholder="Введите название задачи"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Описание
                </label>
                <textarea
                  value={taskFormData.description}
                  onChange={(e) => setTaskFormData({...taskFormData, description: e.target.value})}
                  rows={3}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
                  placeholder="Опишите задачу"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Дата выполнения
                  </label>
                  <input
                    type="date"
                    value={taskFormData.dueDate}
                    onChange={(e) => setTaskFormData({...taskFormData, dueDate: e.target.value})}
                    className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Время
                  </label>
                  <input
                    type="time"
                    value={taskFormData.dueTime}
                    onChange={(e) => setTaskFormData({...taskFormData, dueTime: e.target.value})}
                    className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-0"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsTaskModalOpen(false)
                    setTaskFormData({ title: '', description: '', dueDate: '', dueTime: '' })
                  }}
                  className="btn-secondary text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn-primary text-sm"
                >
                  Создать задачу
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEmailModalOpen && (
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