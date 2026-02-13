'use client'

import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { PuzzleIcon, SearchIcon, UsersGroupIcon, EditIcon, TrashIcon, KeyIcon } from '@/components/Icons'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import PaymentPeriodModal from '@/components/PaymentPeriodModal'
import TelegramBotSection from '@/app/company/TelegramBotSection'
import MoyskladSection from '@/app/company/MoyskladSection'
import MigrationSection from '@/app/company/MigrationSection'

type EntityType = 'contacts' | 'deals' | 'tasks' | 'events'
type PermissionAction = 'create' | 'edit' | 'delete'

interface EntityPermissions {
  create: boolean
  edit: boolean
  delete: boolean
}

type RolePermissions = Record<EntityType, EntityPermissions>
type RolePermissionsMap = Record<string, RolePermissions>

interface User {
  id: number
  email: string
  name: string
  role: string
  permissions?: RolePermissions | null
  visibilityScope?: string | null
  assignedPipelineIds?: number[] | null
  createdAt: string
  stats: {
    contacts: number
    tasks: number
    deals: number
    events: number
  }
}

interface Plan {
  id: number
  name: string
  slug: string
  description: string | null
  price: number
  currency: string
  userLimit: number | null
  contactLimit: number | null
  pipelineLimit: number | null
  features: Record<string, any> | null
}

interface SubscriptionInfo {
  id: number
  status: string
  currentPeriodEnd: string | null
  plan: Plan
}

export default function CompanyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingError, setBillingError] = useState('')
  const [billingMessage, setBillingMessage] = useState('')
  const [syncPlansLoading, setSyncPlansLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [paymentPeriodModalOpen, setPaymentPeriodModalOpen] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [selectedPlanName, setSelectedPlanName] = useState<string>('')
  const [isLegalEntity, setIsLegalEntity] = useState(false)
  const didInitRef = useRef(false)
  const didAutoRefetchRef = useRef(false)
  const didAutoSyncRef = useRef(false)
  const isTrialActive =
    subscription?.status === 'TRIAL' &&
    !!subscription?.currentPeriodEnd &&
    new Date(subscription.currentPeriodEnd) > new Date()
  /** Можно сменить тариф с перерасчётом: активная платная подписка с периодом. */
  const canProrateChange =
    subscription?.status === 'ACTIVE' &&
    !!subscription?.currentPeriodEnd &&
    new Date(subscription.currentPeriodEnd) > new Date() &&
    (subscription?.plan?.price ?? 0) > 0

  // Форма создания пользователя
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'manager' as 'user' | 'manager' | 'department_head' | 'admin'
  })

  // Модальные окна
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Форма редактирования
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    role: 'manager' as 'user' | 'manager' | 'department_head' | 'admin'
  })

  // Форма смены пароля
  const [passwordFormData, setPasswordFormData] = useState({
    password: '',
    confirmPassword: ''
  })

  // Права и роли
  const [rolePermissions, setRolePermissions] = useState<RolePermissionsMap | null>(null)
  const [rolePermsLoading, setRolePermsLoading] = useState(false)
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false)
  const [userPermissionsForm, setUserPermissionsForm] = useState<RolePermissions | null>(null)

  // Видимость данных
  const [visibilityModalOpen, setVisibilityModalOpen] = useState(false)
  const [visibilityForm, setVisibilityForm] = useState({ visibilityScope: 'own' as string, assignedPipelineIds: [] as number[] })
  const [pipelines, setPipelines] = useState<Array<{ id: number; name: string }>>([])

  const safeJson = useCallback(async <T,>(response: Response): Promise<T | null> => {
    const text = await response.text()
    if (!text) {
      return null
    }
    try {
      return JSON.parse(text) as T
    } catch {
      return null
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (!response.ok) {
        if (response.status === 403) {
          router.push('/')
          return
        }
        throw new Error('Ошибка загрузки пользователей')
      }
      const data = await response.json()
      setUsers(data.users || [])
    } catch (error: any) {
      console.error('Error fetching users:', error)
      setError('Ошибка загрузки пользователей')
    } finally {
      setLoading(false)
    }
  }, [router])

  const fetchRolePermissions = useCallback(async () => {
    setRolePermsLoading(true)
    try {
      const response = await fetch('/api/admin/role-permissions')
      if (response.ok) {
        const data = await response.json()
        setRolePermissions(data.rolePermissions)
      }
    } catch (err) {
      console.error('Error fetching role permissions:', err)
    } finally {
      setRolePermsLoading(false)
    }
  }, [])

  const fetchPipelines = useCallback(async () => {
    try {
      const response = await fetch('/api/pipelines')
      if (response.ok) {
        const data = await response.json()
        setPipelines(data || [])
      }
    } catch (err) {
      console.error('Error fetching pipelines:', err)
    }
  }, [])

  const fetchBilling = useCallback(async () => {
    setBillingLoading(true)
    setBillingError('')
    try {
      const [plansRes, subscriptionRes, companyStatsRes] = await Promise.all([
        fetch('/api/billing/plans', { cache: 'no-store' }),
        fetch('/api/billing/subscription', { cache: 'no-store' }),
        fetch('/api/admin/company-stats'),
      ])

      if (!plansRes.ok) {
        throw new Error('Не удалось загрузить список тарифов')
      }

      const plansData = await safeJson<{ plans?: Plan[] }>(plansRes)
      setPlans(plansData?.plans || [])

      if (subscriptionRes.ok) {
        const subscriptionData = await safeJson<{ subscription?: SubscriptionInfo | null }>(subscriptionRes)
        setSubscription(subscriptionData?.subscription || null)
      } else if (subscriptionRes.status === 401 || subscriptionRes.status === 403) {
        setSubscription(null)
      }

      // Получаем информацию о компании для определения типа плательщика
      if (companyStatsRes.ok) {
        const companyData = await safeJson<{ company?: { isLegalEntity?: boolean } }>(companyStatsRes)
        if (companyData?.company?.isLegalEntity !== undefined) {
          setIsLegalEntity(companyData.company.isLegalEntity)
        }
      }

    } catch (error: any) {
      console.error('Error fetching billing data:', error)
      setBillingError(error.message || 'Не удалось загрузить данные по тарифу')
    } finally {
      setBillingLoading(false)
    }
  }, [safeJson])

  /** Принудительно перезаписать описания тарифов из кода (исправление кракозябр в БД). */
  const syncPlanDescriptions = useCallback(async () => {
    setSyncPlansLoading(true)
    try {
      const res = await fetch('/api/billing/plans/sync', { method: 'POST' })
      if (res.ok) {
        await fetchBilling()
        setBillingMessage('Описания тарифов обновлены')
        setTimeout(() => setBillingMessage(''), 4000)
      }
    } catch {
      setBillingError('Не удалось обновить описания')
    } finally {
      setSyncPlansLoading(false)
    }
  }, [fetchBilling])

  // Обновление подписки без кнопки: после возврата с оплаты (webhook может прийти с задержкой)
  const refetchSubscription = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/subscription', { cache: 'no-store' })
      if (res.ok) {
        const data = await safeJson<{ subscription?: SubscriptionInfo | null }>(res)
        setSubscription(data?.subscription ?? null)
      }
    } catch {
      // игнорируем ошибки фонового обновления
    }
  }, [safeJson])

  // Разовое обновление подписки через 2.5 с после загрузки страницы (подхватить webhook после возврата с оплаты)
  useEffect(() => {
    if (status !== 'authenticated' || session?.user?.role !== 'admin' || didAutoRefetchRef.current) return
    didAutoRefetchRef.current = true
    const t = setTimeout(() => refetchSubscription(), 2500)
    return () => clearTimeout(t)
  }, [status, session?.user?.role, refetchSubscription])

  // При возврате на вкладку — обновить подписку (оплата могла пройти в другой вкладке)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetchSubscription()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refetchSubscription])

  // Автоматическая проверка оплаты в фоне после загрузки (без кнопки): если webhook ещё не пришёл — подтягиваем из ЮKassa
  useEffect(() => {
    if (status !== 'authenticated' || session?.user?.role !== 'admin' || didAutoSyncRef.current) return
    didAutoSyncRef.current = true
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/billing/sync-payment', { method: 'POST' })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.activated) refetchSubscription()
      } catch {
        // игнорируем
      }
    }, 3500)
    return () => clearTimeout(t)
  }, [status, session?.user?.role, refetchSubscription])

  useEffect(() => {
    if (status !== 'authenticated' || session?.user?.role !== 'admin') {
      didInitRef.current = false
    }

    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated') {
      const userRole = session?.user?.role
      // Для owner и других ролей - редирект на главную
      // Только admin может видеть страницу компании
      if (userRole !== 'admin') {
        router.push('/')
        return
      }

      // Защита от многократной инициализации (useSession может обновлять объект session)
      if (!didInitRef.current) {
        didInitRef.current = true
        fetchUsers()
        fetchBilling()
        fetchRolePermissions()
        fetchPipelines()
      }

    }
  }, [fetchBilling, fetchPipelines, fetchRolePermissions, fetchUsers, router, session?.user?.role, status])

  const formatPrice = (plan: Plan) => {
    if (!plan.price || plan.price <= 0) {
      return 'Бесплатно'
    }
    try {
      const formatter = new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: plan.currency || 'RUB',
        minimumFractionDigits: 0,
      })
      return `${formatter.format(plan.price)} / мес`
    } catch {
      return `${plan.price.toLocaleString('ru-RU')} ${plan.currency || '₽'} / мес`
    }
  }

  const handlePlanChange = (planId: number) => {
    const plan = plans.find(p => p.id === planId)
    setSelectedPlanId(planId)
    setSelectedPlanName(plan?.name || '')
    setBillingError('')
    setBillingMessage('')
    setPaymentPeriodModalOpen(true)
  }

  const handleTrialSwitch = async (planId: number) => {
    setBillingError('')
    setBillingMessage('')
    setBillingLoading(true)

    try {
      const response = await fetch('/api/billing/subscription', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId }),
      })

      const data = await safeJson<{ subscription?: SubscriptionInfo; error?: string }>(response)
      if (!response.ok) {
        throw new Error(data?.error || `Не удалось переключить тариф (HTTP ${response.status})`)
      }

      if (data?.subscription) {
        setSubscription(data.subscription)
        const planName = data.subscription?.plan?.name ?? ''
        setBillingMessage(`Пробный тариф переключен на «${planName}».`)
      }

      await fetchBilling()
      await fetchUsers()
    } catch (error: any) {
      console.error('Error switching trial plan:', error)
      setBillingError(error.message || 'Не удалось переключить тариф')
    } finally {
      setBillingLoading(false)
    }
  }

  /** Смена тарифа с перерасчётом по остатку (месяц = 30 дней, без доплаты). */
  const handleChangePlanWithProration = async (planId: number) => {
    setBillingError('')
    setBillingMessage('')
    setBillingLoading(true)
    try {
      const response = await fetch('/api/billing/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      const data = await safeJson<{
        subscription?: { id: number; status?: string; planId: number; plan?: Plan; currentPeriodEnd: string | null }
        error?: string
      }>(response)
      if (!response.ok) {
        throw new Error(data?.error || 'Не удалось сменить тариф')
      }
      const sub = data?.subscription
      const newPlan = sub?.plan
      if (sub && newPlan) {
        setSubscription((prev) => ({
          ...(prev ?? { id: 0, status: 'ACTIVE', planId: 0, plan: newPlan, currentPeriodEnd: null }),
          id: sub.id,
          status: sub.status ?? 'ACTIVE',
          planId: sub.planId,
          plan: newPlan,
          currentPeriodEnd: sub.currentPeriodEnd,
        }))
      }
      const endDate = sub?.currentPeriodEnd
        ? new Date(sub.currentPeriodEnd).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : ''
      setBillingMessage(
        `Тариф изменён на «${sub?.plan?.name ?? ''}». Подписка пересчитана до ${endDate}.`
      )
      await fetchBilling()
      await fetchUsers()
    } catch (error: any) {
      setBillingError(error.message || 'Не удалось сменить тариф')
    } finally {
      setBillingLoading(false)
    }
  }

  const handlePaymentWithPeriod = async (
    paymentPeriodMonths: 1 | 3 | 6 | 12,
    paymentMethod?: 'yookassa' | 'sbp' | 'invoice'
  ) => {
    if (!selectedPlanId) return

    setBillingError('')
    setBillingMessage('')
    setBillingLoading(true)
    setPaymentPeriodModalOpen(false)

    try {
      // Для юридических лиц проверяем выбранный способ оплаты
      if (isLegalEntity) {
        // Если выбран способ "счет", используем endpoint генерации счета
        if (paymentMethod === 'invoice') {
          const invoiceResponse = await fetch('/api/billing/invoice/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ planId: selectedPlanId, paymentPeriodMonths }),
          })

          const invoiceData = await invoiceResponse.json()
          if (!invoiceResponse.ok) {
            throw new Error(invoiceData.error || 'Не удалось создать счет')
          }

          // Обновляем список pending invoices
          await fetchBilling()

          // Автоматически скачиваем PDF счета (без необходимости выходить и жать "Скачать счет")
          const pdfUrl: string | undefined =
            invoiceData?.pdfUrl || (invoiceData?.invoice?.id ? `/api/billing/invoice/${invoiceData.invoice.id}/pdf` : undefined)
          if (pdfUrl && typeof window !== 'undefined') {
            const filename = invoiceData?.invoice?.invoiceNumber
              ? `invoice-${invoiceData.invoice.invoiceNumber}.pdf`
              : 'invoice.pdf'
            const a = document.createElement('a')
            a.href = pdfUrl
            a.download = filename
            a.rel = 'noopener noreferrer'
            document.body.appendChild(a)
            a.click()
            a.remove()
          }
          
          // Не показываем сообщение и не запускаем проверку статуса
          // Пользователь может выбрать другой тариф/срок/способ оплаты
          return
        }
        // Если выбран способ "YooKassa", используем обычный endpoint оплаты
        // (продолжаем выполнение ниже)
      }

      // Для физических лиц и юридических лиц с оплатой через YooKassa используем обычный endpoint оплаты
      const paymentResponse = await fetch('/api/billing/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: selectedPlanId,
          paymentPeriodMonths,
          ...(paymentMethod === 'sbp' ? { paymentMethodType: 'sbp' } : {}),
        }),
      })

      const paymentData = await paymentResponse.json()
      if (!paymentResponse.ok) {
        throw new Error(paymentData.error || 'Не удалось создать платеж')
      }

      // Если план бесплатный или в режиме разработки, подписка уже активирована
      if (paymentData.subscription) {
        setSubscription(paymentData.subscription)
        const planName = paymentData.subscription?.plan?.name ?? ''
        setBillingMessage(`План «${planName}» успешно активирован! Лимиты обновлены.`)
        await fetchBilling()
        await fetchUsers()
        return
      }

      // Если есть URL для оплаты, перенаправляем пользователя
      if (paymentData.paymentUrl) {
        window.location.href = paymentData.paymentUrl
        return
      }

      // Если платеж создан, но URL нет, обновляем подписку
      await fetchBilling()
      setBillingMessage('Платеж создан. Ожидаем подтверждения...')
    } catch (error: any) {
      console.error('Error updating plan:', error)
      setBillingError(error.message || 'Не удалось обновить тариф')
    } finally {
      setBillingLoading(false)
      setSelectedPlanId(null)
      setSelectedPlanName('')
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setCreating(true)

    try {
      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Ошибка создания пользователя')
      }

      setSuccess(`Пользователь ${data.user.name} успешно создан!`)
      setFormData({
        email: '',
        password: '',
        name: '',
        role: 'manager'
      })
      
      // Обновляем список пользователей
      await fetchUsers()
    } catch (error: any) {
      console.error('Error creating user:', error)
      setError(error.message || 'Ошибка создания пользователя')
    } finally {
      setCreating(false)
    }
  }

  const handleEditClick = (user: User) => {
    setSelectedUser(user)
    setEditFormData({
      name: user.name,
      email: user.email,
      role: user.role as 'user' | 'manager' | 'department_head' | 'admin'
    })
    setEditModalOpen(true)
    setError('')
    setSuccess('')
  }

  const handlePasswordClick = (user: User) => {
    setSelectedUser(user)
    setPasswordFormData({
      password: '',
      confirmPassword: ''
    })
    setPasswordModalOpen(true)
    setError('')
    setSuccess('')
  }

  const handleDeleteClick = (user: User) => {
    setSelectedUser(user)
    setDeleteConfirmOpen(true)
    setError('')
    setSuccess('')
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    setError('')
    setSuccess('')
    setUpdating(true)

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editFormData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка обновления пользователя')
      }

      setSuccess(`Пользователь ${data.user.name} успешно обновлен!`)
      setEditModalOpen(false)
      setSelectedUser(null)
      
      // Обновляем список пользователей
      await fetchUsers()
    } catch (error: any) {
      console.error('Error updating user:', error)
      setError(error.message || 'Ошибка обновления пользователя')
    } finally {
      setUpdating(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    if (passwordFormData.password !== passwordFormData.confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    if (passwordFormData.password.length < 6) {
      setError('Пароль должен быть не менее 6 символов')
      return
    }

    setError('')
    setSuccess('')
    setUpdating(true)

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: passwordFormData.password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка смены пароля')
      }

      setSuccess(`Пароль для ${selectedUser.name} успешно изменен!`)
      setPasswordModalOpen(false)
      setSelectedUser(null)
      setPasswordFormData({ password: '', confirmPassword: '' })
    } catch (error: any) {
      console.error('Error changing password:', error)
      setError(error.message || 'Ошибка смены пароля')
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return

    setError('')
    setSuccess('')
    setDeleting(true)

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка удаления пользователя')
      }

      setSuccess(`Пользователь ${selectedUser.name} успешно удален!`)
      setDeleteConfirmOpen(false)
      setSelectedUser(null)
      
      // Обновляем список пользователей
      await fetchUsers()
    } catch (error: any) {
      console.error('Error deleting user:', error)
      setError(error.message || 'Ошибка удаления пользователя')
    } finally {
      setDeleting(false)
    }
  }

  const getRoleBadge = (role: string) => {
    const badges = {
      admin: 'bg-[var(--error-soft)] text-[var(--error)] border-[var(--error)]/30',
      manager: 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary)]/30',
      user: 'bg-[var(--background-soft)] text-[var(--muted)] border-[var(--border)]'
    }
    return badges[role as keyof typeof badges] || badges.user
  }

  const getRoleName = (role: string) => {
    const names = {
      admin: 'Администратор',
      department_head: 'Руководитель отдела',
      manager: 'Менеджер',
      user: 'Пользователь'
    }
    return names[role as keyof typeof names] || role
  }

  const ENTITIES: { key: EntityType; label: string }[] = [
    { key: 'contacts', label: 'Контакты' },
    { key: 'deals', label: 'Сделки' },
    { key: 'tasks', label: 'Задачи' },
    { key: 'events', label: 'События' },
  ]
  const ROLES: { key: string; label: string }[] = [
    { key: 'manager', label: 'Менеджер' },
    { key: 'department_head', label: 'Руководитель отдела' },
    { key: 'admin', label: 'Администратор' },
  ]
  const DEFAULT_ROLE_PERMS: RolePermissionsMap = {
    manager: { contacts: { create: true, edit: true, delete: false }, deals: { create: true, edit: true, delete: false }, tasks: { create: true, edit: true, delete: false }, events: { create: true, edit: true, delete: false } },
    department_head: { contacts: { create: true, edit: true, delete: true }, deals: { create: true, edit: true, delete: true }, tasks: { create: true, edit: true, delete: true }, events: { create: true, edit: true, delete: true } },
    admin: { contacts: { create: true, edit: true, delete: true }, deals: { create: true, edit: true, delete: true }, tasks: { create: true, edit: true, delete: true }, events: { create: true, edit: true, delete: true } },
  }
  const rolePerms = rolePermissions ?? DEFAULT_ROLE_PERMS

  const handleRolePermChange = (roleKey: string, entity: EntityType, action: PermissionAction, value: boolean) => {
    if (roleKey === 'admin') return
    setRolePermissions((prev) => {
      const next = { ...(prev ?? DEFAULT_ROLE_PERMS) }
      if (!next[roleKey]) next[roleKey] = { ...DEFAULT_ROLE_PERMS.manager }
      next[roleKey] = { ...next[roleKey], [entity]: { ...next[roleKey][entity], [action]: value } }
      return next
    })
  }

  const handleSaveRolePermissions = async () => {
    setRolePermsLoading(true)
    try {
      const response = await fetch('/api/admin/role-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rolePermissions: rolePerms }),
      })
      if (response.ok) {
        setSuccess('Права по ролям сохранены')
      } else {
        const data = await response.json()
        setError(data.error || 'Ошибка сохранения')
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка сохранения')
    } finally {
      setRolePermsLoading(false)
    }
  }

  const handlePermissionsClick = (user: User) => {
    setSelectedUser(user)
    const base = user.permissions ?? rolePerms[user.role] ?? DEFAULT_ROLE_PERMS.manager
    setUserPermissionsForm(JSON.parse(JSON.stringify(base)))
    setPermissionsModalOpen(true)
    setError('')
    setSuccess('')
  }

  const handleUserPermChange = (entity: EntityType, action: PermissionAction, value: boolean) => {
    setUserPermissionsForm((prev) => {
      if (!prev) return prev
      const next = { ...prev, [entity]: { ...prev[entity], [action]: value } }
      return next
    })
  }

  const handleSaveUserPermissions = async () => {
    if (!selectedUser || !userPermissionsForm) return
    setUpdating(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: userPermissionsForm }),
      })
      if (response.ok) {
        setSuccess(`Права для ${selectedUser.name} сохранены`)
        setPermissionsModalOpen(false)
        setSelectedUser(null)
        setUserPermissionsForm(null)
        await fetchUsers()
      } else {
        const data = await response.json()
        setError(data.error || 'Ошибка сохранения')
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка сохранения')
    } finally {
      setUpdating(false)
    }
  }

  const handleVisibilityClick = (user: User) => {
    setSelectedUser(user)
    const scope = user.visibilityScope || (user.role === 'admin' ? 'all' : user.role === 'department_head' ? 'department' : 'own')
    setVisibilityForm({
      visibilityScope: scope,
      assignedPipelineIds: Array.isArray(user.assignedPipelineIds) ? [...user.assignedPipelineIds] : [],
    })
    setVisibilityModalOpen(true)
    setError('')
    setSuccess('')
  }

  const handleVisibilityPipelineToggle = (pipelineId: number) => {
    setVisibilityForm((prev) => {
      const ids = prev.assignedPipelineIds.includes(pipelineId)
        ? prev.assignedPipelineIds.filter((id) => id !== pipelineId)
        : [...prev.assignedPipelineIds, pipelineId]
      return { ...prev, assignedPipelineIds: ids }
    })
  }

  const handleSaveVisibility = async () => {
    if (!selectedUser) return
    setUpdating(true)
    setError('')
    setSuccess('')
    try {
      const body = {
        visibilityScope: visibilityForm.visibilityScope,
        assignedPipelineIds: visibilityForm.assignedPipelineIds,
      }
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (response.ok) {
        setSuccess(`Видимость для ${selectedUser.name} сохранена`)
        setVisibilityModalOpen(false)
        setSelectedUser(null)
        await fetchUsers()
      } else {
        const data = await response.json()
        setError(data.error || 'Ошибка сохранения')
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка сохранения')
    } finally {
      setUpdating(false)
    }
  }

  const getVisibilityLabel = (u: User) => {
    const scope = u.visibilityScope || (u.role === 'admin' ? 'all' : u.role === 'department_head' ? 'department' : 'own')
    if (scope === 'all') return 'Всё'
    if (scope === 'department') {
      const ids = Array.isArray(u.assignedPipelineIds) ? u.assignedPipelineIds : []
      if (ids.length === 0) return 'Только свои'
      const names = ids.map((id) => pipelines.find((p) => p.id === id)?.name || `#${id}`).join(', ')
      return names || 'Отделы'
    }
    return 'Только свои'
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4" />
          <p className="text-[var(--muted)]">Загрузка настроек компании...</p>
        </div>
      </div>
    )
  }

  // Для owner и других ролей - не показываем страницу
  const userRole = session?.user?.role
  if (userRole !== 'admin') {
    return null
  }

  const filteredUsers = users.filter((user) => {
    const term = userSearch.toLowerCase().trim()
    if (!term) return true
    return (
      user.name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      getRoleName(user.role).toLowerCase().includes(term)
    )
  })

  const roleStats = users.reduce<Record<string, number>>((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1
    return acc
  }, {})

  const summaryCards = [
    {
      label: 'Команда',
      value: users.length,
      note: `Админов ${roleStats.admin ?? 0}, менеджеров ${roleStats.manager ?? 0}`,
    },
    {
      label: 'Тариф',
      value: subscription?.plan?.name ?? 'Не выбран',
      note: subscription?.plan ? formatPrice(subscription.plan) : 'Подключите план',
    },
    {
      label: 'Следующее продление',
      value: subscription?.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '—',
      note: subscription?.currentPeriodEnd ? 'Оплачено до' : 'Ещё не настроено',
    },
    {
      label: 'Фильтр',
      value: `${filteredUsers.length} из ${users.length}`,
      note: userSearch ? 'Применён поиск' : 'Все пользователи',
    },
  ]

  return (
    <div className="space-y-8 w-full">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Профиль компании</p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">
            Управление командой и тарифами
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Контролируйте доступ, роли и подписку Flame CRM из одного окна.
          </p>
        </div>
        <a
          href="/company/custom-fields"
          className="btn-secondary text-sm"
        >
          <PuzzleIcon className="w-4 h-4" /> Кастомные поля
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="stat-card">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)] mb-1">{card.label}</p>
            <p className="stat-card-value">{card.value}</p>
            <p className="text-sm text-[var(--muted)]">{card.note}</p>
          </div>
        ))}
      </div>

      {/* Сообщения */}
      <div className="space-y-3">
        {error && (
          <div className="rounded-2xl border border-[var(--error)]/30 bg-[var(--error-soft)] px-4 py-3 text-[var(--error)]">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-[var(--success)]/30 bg-[var(--success-soft)] px-4 py-3 text-[var(--success)]">
            {success}
          </div>
        )}
        {billingError && (
          <div className="rounded-2xl border border-[var(--error)]/30 bg-[var(--error-soft)] px-4 py-3 text-[var(--error)]">
            {billingError}
          </div>
        )}
        {billingMessage && (
          <div className="rounded-2xl border border-[var(--success)]/30 bg-[var(--success-soft)] px-4 py-3 text-[var(--success)]">
            {billingMessage}
          </div>
        )}
      </div>

      <section className="space-y-4 mb-8">
        <div className="glass-panel rounded-3xl p-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Текущий тариф</p>
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">
              {subscription?.plan?.name ?? 'План не выбран'}
            </h2>
            <p className="text-sm text-[var(--muted)]">
              {subscription?.plan?.description ?? 'Тариф определяет лимиты по пользователям и расширенным функциям CRM.'}
            </p>
          </div>
          <div className="text-sm text-[var(--muted)] text-left md:text-right flex flex-col gap-2 items-start md:items-end">
            {subscription?.plan ? (
              <>
                <p className="text-lg font-semibold text-[var(--foreground)]">{formatPrice(subscription.plan)}</p>
                {subscription?.currentPeriodEnd && (
                  <span className="text-xs text-[var(--muted)]">
                    {isTrialActive
                      ? `Пробный период до: ${new Date(subscription.currentPeriodEnd).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                      : `Продление: ${new Date(subscription.currentPeriodEnd).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
                  </span>
                )}
              </>
            ) : (
              <p>Нет активной подписки</p>
            )}
          </div>
        </div>

        {/* Кнопка исправления кракозябр в описаниях тарифов — видна всем авторизованным */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={syncPlanDescriptions}
            disabled={syncPlansLoading}
            className="rounded-xl border border-[var(--border)] bg-[var(--background-soft)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)] transition disabled:opacity-50"
          >
            {syncPlansLoading ? 'Обновление…' : 'Исправить отображение тарифов (обновить описания)'}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {billingLoading && plans.length === 0 ? (
            <div className="col-span-full text-center text-slate-500">Загрузка тарифов...</div>
          ) : (
            plans.map((plan) => {
              const isCurrent = subscription?.plan?.id === plan.id
              const highlights = Array.isArray(plan.features?.highlights) ? (plan.features?.highlights as string[]) : []
              const limits: string[] = []
              if (typeof plan.userLimit === 'number') {
                limits.push(`До ${plan.userLimit} пользователей`)
              } else {
                limits.push('Пользователи без ограничений')
              }
              if (typeof plan.contactLimit === 'number') {
                limits.push(`До ${plan.contactLimit.toLocaleString('ru-RU')} контактов`)
              } else {
                limits.push('Неограниченное число контактов')
              }
              if (typeof plan.pipelineLimit === 'number') {
                limits.push(`До ${plan.pipelineLimit} воронок`)
              } else {
                limits.push('Неограниченное число воронок')
              }

              const items = [...highlights, ...limits]

              // Привязка к пакетам S/M/L по лимиту пользователей
              const tier =
                typeof plan.userLimit === 'number'
                  ? plan.userLimit <= 5
                    ? 'S'
                    : plan.userLimit <= 15
                    ? 'M'
                    : 'L'
                  : 'L'

              return (
                <div
                  key={plan.id}
                  className={`card h-full flex flex-col gap-4 border ${isCurrent ? 'ring-2 ring-[var(--primary)]/50' : ''}`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--background-soft)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                        План {tier}
                      </span>
                      {isTrialActive && (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-semibold border border-emerald-100">
                          14 дней бесплатно
                        </span>
                      )}
                    </div>
                    <h3 className="text-2xl font-semibold text-[var(--foreground)]">{plan.name}</h3>
                    <p className="text-sm text-[var(--muted)]">
                      {plan.description || 'Полный функционал CRM без ограничений по модулям и доплат.'}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-semibold text-[var(--foreground)]">{formatPrice(plan)}</p>
                      {isTrialActive && (
                        <span className="text-xs text-[var(--muted)]">после пробного периода</span>
                      )}
                    </div>
                  </div>
                  <ul className="space-y-2 text-sm text-[var(--muted)] flex-1">
                    {items.map((item, index) => (
                      <li key={`${plan.id}-${index}`} className="flex items-start gap-2">
                        <span className="text-[var(--primary)] mt-1">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  {isTrialActive ? (
                    <div className="flex flex-col gap-2">
                      {!isCurrent && (
                        <button
                          onClick={() => handleTrialSwitch(plan.id)}
                          disabled={billingLoading}
                          className="w-full rounded-2xl px-4 py-2 text-sm font-medium transition border border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--background-soft)]"
                        >
                          Переключить на пробный
                        </button>
                      )}
                      <button
                        onClick={() => handlePlanChange(plan.id)}
                        disabled={billingLoading}
                        className="w-full rounded-2xl px-4 py-2 text-sm font-medium transition bg-[var(--primary)] text-white hover:opacity-90"
                      >
                        Оформить подписку
                      </button>
                    </div>
                  ) : (
                    <>
                      {canProrateChange && !isCurrent && (plan.price ?? 0) > 0 ? (
                        <button
                          onClick={() => handleChangePlanWithProration(plan.id)}
                          disabled={billingLoading}
                          className="w-full rounded-2xl px-4 py-2 text-sm font-medium transition bg-[var(--primary)] text-white hover:opacity-90"
                        >
                          Перейти с пересчётом
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePlanChange(plan.id)}
                          disabled={billingLoading}
                          className={`w-full rounded-2xl px-4 py-2 text-sm font-medium transition ${
                            isCurrent
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-[var(--primary)] text-white hover:opacity-90'
                          }`}
                        >
                          {isCurrent ? 'Продлить' : 'Перейти'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            })
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Форма создания пользователя */}
        <div className="glass-panel rounded-3xl p-6 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Команда</p>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Создать нового пользователя</h2>
          </div>
          
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Имя
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                placeholder="Иван Иванов"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Email (логин)
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Пароль
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                placeholder="Минимум 6 символов"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Роль
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'user' | 'manager' | 'department_head' | 'admin' })}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
              >
                <option value="user">Пользователь</option>
                <option value="manager">Менеджер</option>
                <option value="department_head">Руководитель отдела</option>
                <option value="admin">Администратор</option>
              </select>
              <p className="text-xs text-[var(--muted)] mt-1">
                Менеджер видит только свои данные, админ видит всю компанию
              </p>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Создание...' : 'Создать пользователя'}
            </button>
          </form>
        </div>

        {/* Список пользователей */}
        <div className="glass-panel rounded-3xl p-6 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Команда</p>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                Пользователи компании ({users.length})
              </h2>
            </div>
            <div className="relative w-full md:w-72">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
              <input
                type="text"
                placeholder="Поиск по имени или email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full rounded-2xl border border-[var(--border)] bg-white/90 pl-10 pr-4 py-2.5 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
              />
            </div>
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Найдено: {filteredUsers.length}
          </p>

          {filteredUsers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <UsersGroupIcon className="w-12 h-12 text-[var(--muted)]" />
              </div>
              <h3 className="empty-state-title">Пользователи не найдены</h3>
              <p className="empty-state-description">
                {userSearch
                  ? 'Сбросьте поиск или добавьте нового пользователя.'
                  : 'Добавьте первого сотрудника, чтобы начать совместную работу.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="card-interactive"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-[var(--foreground)]">{user.name}</h3>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getRoleBadge(user.role)}`}>
                          {getRoleName(user.role)}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--muted)] mb-1">{user.email}</p>
                      <p className="text-xs text-[var(--muted)]">
                        Создан: {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVisibilityClick(user)}
                        className="px-3 py-2 text-sm rounded-xl bg-[var(--background-soft)] text-[var(--foreground)] hover:bg-[var(--background-soft)]/70 transition-colors"
                        title="Видимость данных"
                      >
                        👁️
                      </button>
                      <button
                        onClick={() => handlePermissionsClick(user)}
                        className="px-3 py-2 text-sm rounded-xl bg-[var(--background-soft)] text-[var(--foreground)] hover:bg-[var(--background-soft)]/70 transition-colors"
                        title="Права"
                      >
                        🔐
                      </button>
                      <button
                        onClick={() => handleEditClick(user)}
                        className="px-3 py-2 text-sm rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] hover:bg-[var(--primary-soft)]/70 transition-colors"
                        title="Редактировать"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handlePasswordClick(user)}
                        className="px-3 py-2 text-sm rounded-xl bg-[var(--warning-soft)] text-[var(--warning)] hover:bg-[var(--warning-soft)]/70 transition-colors"
                        title="Изменить пароль"
                      >
                        <KeyIcon className="w-4 h-4" />
                      </button>
                      {user.id !== parseInt(session?.user?.id || '0') && (
                        <button
                          onClick={() => handleDeleteClick(user)}
                          className="px-3 py-2 text-sm rounded-xl bg-[var(--error-soft)] text-[var(--error)] hover:bg-[var(--error-soft)]/70 transition-colors"
                          title="Удалить"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Статистика пользователя */}
                  <div className="mt-3 pt-3 border-t border-white/60 grid grid-cols-4 gap-2 text-xs">
                    <div className="text-center">
                      <div className="font-semibold text-[var(--foreground)]">{user.stats.contacts}</div>
                      <div className="text-[var(--muted)]">Контакты</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-[var(--foreground)]">{user.stats.tasks}</div>
                      <div className="text-[var(--muted)]">Задачи</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-[var(--foreground)]">{user.stats.deals}</div>
                      <div className="text-[var(--muted)]">Сделки</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-[var(--foreground)]">{user.stats.events}</div>
                      <div className="text-[var(--muted)]">События</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Раздел видимости данных */}
      <section className="space-y-4">
        <div className="glass-panel rounded-3xl p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Видимость данных</h2>
            <p className="text-sm text-[var(--muted)] mt-1">
              Настройте, какие сделки, контакты и задачи видит каждый сотрудник. Менеджеры — только свои, начальник отдела — выбранные воронки/отделы, администратор — всё.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-3 px-2 font-semibold text-[var(--foreground)]">Сотрудник</th>
                  <th className="text-left py-3 px-2 font-semibold text-[var(--foreground)]">Роль</th>
                  <th className="text-left py-3 px-2 font-semibold text-[var(--foreground)]">Видит</th>
                  <th className="text-right py-3 px-2 font-semibold text-[var(--foreground)]">Действие</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-[var(--border)]">
                    <td className="py-3 px-2 font-medium text-[var(--foreground)]">{u.name}</td>
                    <td className="py-3 px-2 text-[var(--muted)]">{getRoleName(u.role)}</td>
                    <td className="py-3 px-2 text-[var(--muted)]">{getVisibilityLabel(u)}</td>
                    <td className="py-3 px-2 text-right">
                      <button
                        onClick={() => handleVisibilityClick(u)}
                        className="px-3 py-1.5 text-sm text-[var(--primary)] hover:bg-[var(--primary-soft)] rounded-lg transition-colors"
                      >
                        Настроить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Раздел прав и ролей */}
      <section className="space-y-4">
        <div className="glass-panel rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Права и роли</h2>
              <p className="text-sm text-[var(--muted)]">Настройте права по умолчанию для каждой роли. У администратора все права включены.</p>
            </div>
            <button
              onClick={handleSaveRolePermissions}
              disabled={rolePermsLoading}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {rolePermsLoading ? 'Сохранение...' : 'Сохранить права'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-3 px-2 font-semibold text-[var(--foreground)]">Роль</th>
                  {ENTITIES.map((e) => {
                    const short = e.key === 'contacts' ? 'К' : e.key === 'deals' ? 'С' : e.key === 'tasks' ? 'З' : 'Сб'
                    return (
                      <th key={e.key} colSpan={3} className="text-center py-3 px-2 font-semibold text-[var(--foreground)] border-l border-[var(--border)] first:border-l-0">
                        {short}: {e.label}
                      </th>
                    )
                  })}
                </tr>
                <tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                  <th className="py-2 px-2"></th>
                  {ENTITIES.flatMap(() => ['Созд.', 'Ред.', 'Удал.']).map((a, i) => (
                    <th key={i} className="py-2 px-2 text-center">{a}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROLES.map((r) => (
                  <tr key={r.key} className="border-b border-[var(--border)]">
                    <td className="py-3 px-2 font-medium text-[var(--foreground)]">{r.label}</td>
                    {ENTITIES.map((e) => (
                      <Fragment key={e.key}>
                        {(['create', 'edit', 'delete'] as const).map((action) => (
                          <td key={`${e.key}-${action}`} className="py-2 px-2 text-center border-l border-[var(--border)] first:border-l-0">
                            <input
                              type="checkbox"
                              checked={rolePerms[r.key]?.[e.key]?.[action] ?? false}
                              onChange={(ev) => handleRolePermChange(r.key, e.key, action, ev.target.checked)}
                              disabled={r.key === 'admin'}
                              className="h-4 w-4 rounded border-[var(--border)] accent-emerald-500 cursor-pointer disabled:opacity-40 focus:ring-2 focus:ring-emerald-200 focus:ring-offset-0"
                            />
                          </td>
                        ))}
                      </Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Интеграции: Telegram, МойСклад, миграция AmoCRM */}
      <section className="space-y-6">
        <TelegramBotSection />
        <MoyskladSection />
        <MigrationSection />
      </section>

      {/* Модальное окно редактирования пользователя */}
      {editModalOpen && selectedUser && (
        <div className="modal-overlay" onClick={() => {
          setEditModalOpen(false)
          setSelectedUser(null)
          setError('')
          setSuccess('')
        }}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)] font-semibold mb-1">Редактирование</p>
                <h2 className="text-2xl font-bold text-[var(--foreground)]">Редактировать пользователя</h2>
              </div>
              <button
                onClick={() => {
                  setEditModalOpen(false)
                  setSelectedUser(null)
                  setError('')
                  setSuccess('')
                }}
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-2 hover:bg-[var(--background-soft)] rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateUser}>
              <div className="modal-body space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Имя
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                    placeholder="Иван Иванов"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Email (логин)
                  </label>
                  <input
                    type="email"
                    required
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                    placeholder="user@example.com"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Роль
                  </label>
                  <select
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as 'user' | 'manager' | 'department_head' | 'admin' })}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                  >
                    <option value="user">Пользователь</option>
                    <option value="manager">Менеджер</option>
                    <option value="department_head">Руководитель отдела</option>
                    <option value="admin">Администратор</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setEditModalOpen(false)
                    setSelectedUser(null)
                    setError('')
                    setSuccess('')
                  }}
                  className="btn-secondary text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="btn-primary text-sm btn-ripple disabled:opacity-50"
                >
                  {updating ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно смены пароля */}
      {passwordModalOpen && selectedUser && (
        <div className="modal-overlay" onClick={() => {
          setPasswordModalOpen(false)
          setSelectedUser(null)
          setError('')
          setSuccess('')
          setPasswordFormData({ password: '', confirmPassword: '' })
        }}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)] font-semibold mb-1">Пароль</p>
                <h2 className="text-2xl font-bold text-[var(--foreground)]">Изменить пароль</h2>
                <p className="text-sm text-[var(--muted)] mt-1">Пользователь: {selectedUser.name}</p>
              </div>
              <button
                onClick={() => {
                  setPasswordModalOpen(false)
                  setSelectedUser(null)
                  setError('')
                  setSuccess('')
                  setPasswordFormData({ password: '', confirmPassword: '' })
                }}
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-2 hover:bg-[var(--background-soft)] rounded-lg"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-[var(--error-soft)] border border-[var(--error)]/30 rounded-lg text-[var(--error)] text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-[var(--success-soft)] border border-[var(--success)]/30 rounded-lg text-[var(--success)] text-sm">
                {success}
              </div>
            )}

            <form onSubmit={handleChangePassword}>
              <div className="modal-body space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Новый пароль
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordFormData.password}
                  onChange={(e) => setPasswordFormData({ ...passwordFormData, password: e.target.value })}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                  placeholder="Минимум 6 символов"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Подтвердите пароль
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordFormData.confirmPassword}
                  onChange={(e) => setPasswordFormData({ ...passwordFormData, confirmPassword: e.target.value })}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                  placeholder="Повторите пароль"
                />
              </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordModalOpen(false)
                    setSelectedUser(null)
                    setError('')
                    setSuccess('')
                    setPasswordFormData({ password: '', confirmPassword: '' })
                  }}
                  className="btn-secondary text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="btn-primary text-sm btn-ripple disabled:opacity-50"
                >
                  {updating ? 'Изменение...' : 'Изменить пароль'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно подтверждения удаления */}
      {deleteConfirmOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[var(--surface)] rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-[var(--foreground)] mb-4">Подтвердите удаление</h2>
            <p className="text-[var(--foreground-soft)] mb-4">
              Вы уверены, что хотите удалить пользователя <strong>{selectedUser.name}</strong>?
              <br />
              <span className="text-sm text-[var(--error)]">Это действие нельзя отменить.</span>
            </p>
            
            {error && (
              <div className="mb-4 p-3 bg-[var(--error-soft)] border border-[var(--error)]/30 rounded-lg text-[var(--error)] text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false)
                  setSelectedUser(null)
                  setError('')
                }}
                className="btn-secondary flex-1"
                disabled={deleting}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-[var(--error)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно прав пользователя */}
      {permissionsModalOpen && selectedUser && userPermissionsForm && (
        <div className="modal-overlay" onClick={() => { setPermissionsModalOpen(false); setSelectedUser(null); setUserPermissionsForm(null); setError(''); setSuccess('') }}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)] font-semibold mb-1">Права доступа</p>
                <h2 className="text-2xl font-bold text-[var(--foreground)]">Права для {selectedUser.name}</h2>
                <p className="text-sm text-[var(--muted)] mt-1">Роль: {getRoleName(selectedUser.role)}. Переопределите права при необходимости.</p>
              </div>
              <button onClick={() => { setPermissionsModalOpen(false); setSelectedUser(null); setUserPermissionsForm(null); setError(''); setSuccess('') }} className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-2 hover:bg-[var(--background-soft)] rounded-lg">✕</button>
            </div>
            {error && <div className="mx-6 mb-4 p-3 bg-[var(--error-soft)] border border-[var(--error)]/30 rounded-lg text-[var(--error)] text-sm">{error}</div>}
            {success && <div className="mx-6 mb-4 p-3 bg-[var(--success-soft)] border border-[var(--success)]/30 rounded-lg text-[var(--success)] text-sm">{success}</div>}
            <div className="modal-body">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-3 px-2 font-semibold text-[var(--foreground)]">Раздел</th>
                      <th className="text-center py-3 px-2 font-semibold text-[var(--foreground)]">Создание</th>
                      <th className="text-center py-3 px-2 font-semibold text-[var(--foreground)]">Редактирование</th>
                      <th className="text-center py-3 px-2 font-semibold text-[var(--foreground)]">Удаление</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ENTITIES.map((e) => (
                      <tr key={e.key} className="border-b border-[var(--border)]">
                        <td className="py-3 px-2 font-medium text-[var(--foreground)]">{e.label}</td>
                        {(['create', 'edit', 'delete'] as const).map((action) => (
                          <td key={action} className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={userPermissionsForm[e.key]?.[action] ?? false}
                              onChange={(ev) => handleUserPermChange(e.key, action, ev.target.checked)}
                              disabled={selectedUser.role === 'admin'}
                              className="rounded border-[var(--border)]"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => { setPermissionsModalOpen(false); setSelectedUser(null); setUserPermissionsForm(null); setError(''); setSuccess('') }} className="btn-secondary text-sm">Отмена</button>
              <button type="button" onClick={handleSaveUserPermissions} disabled={updating} className="btn-primary text-sm disabled:opacity-50">{updating ? 'Сохранение...' : 'Сохранить'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно видимости данных */}
      {visibilityModalOpen && selectedUser && (
        <div className="modal-overlay" onClick={() => { setVisibilityModalOpen(false); setSelectedUser(null); setError(''); setSuccess('') }}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)] font-semibold mb-1">Видимость данных</p>
                <h2 className="text-2xl font-bold text-[var(--foreground)]">Что видит {selectedUser.name}</h2>
                <p className="text-sm text-[var(--muted)] mt-1">Роль: {getRoleName(selectedUser.role)}</p>
              </div>
              <button onClick={() => { setVisibilityModalOpen(false); setSelectedUser(null); setError(''); setSuccess('') }} className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-2 hover:bg-[var(--background-soft)] rounded-lg">✕</button>
            </div>
            {error && <div className="mx-6 mb-4 p-3 bg-[var(--error-soft)] border border-[var(--error)]/30 rounded-lg text-[var(--error)] text-sm">{error}</div>}
            {success && <div className="mx-6 mb-4 p-3 bg-[var(--success-soft)] border border-[var(--success)]/30 rounded-lg text-[var(--success)] text-sm">{success}</div>}
            <div className="modal-body space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Область видимости</label>
                <select
                  value={visibilityForm.visibilityScope}
                  onChange={(e) => setVisibilityForm({ ...visibilityForm, visibilityScope: e.target.value })}
                  disabled={selectedUser.role === 'admin'}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all disabled:opacity-60"
                >
                  <option value="own">Только свои (сделки, контакты, задачи)</option>
                  <option value="department">Выбранные отделы (воронки)</option>
                  <option value="all">Всё</option>
                </select>
                {selectedUser.role === 'admin' && <p className="text-xs text-[var(--muted)] mt-1">У администратора всегда видно всё</p>}
              </div>
              {(visibilityForm.visibilityScope === 'department' || visibilityForm.visibilityScope === 'own') && (
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    {visibilityForm.visibilityScope === 'department' ? 'Воронки / отделы, которые видит' : 'Отдел сотрудника'}
                  </label>
                  <p className="text-sm text-[var(--muted)] mb-2">
                    {visibilityForm.visibilityScope === 'department'
                      ? 'Выберите воронки, данные которых видит сотрудник'
                      : 'К какому отделу относится (нужно для отчётов начальника отдела)'}
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {pipelines.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-[var(--background-soft)]">
                        <input
                          type="checkbox"
                          checked={visibilityForm.assignedPipelineIds.includes(p.id)}
                          onChange={() => handleVisibilityPipelineToggle(p.id)}
                          className="rounded border-[var(--border)]"
                        />
                        <span className="text-sm text-[var(--foreground)]">{p.name}</span>
                      </label>
                    ))}
                    {pipelines.length === 0 && <p className="text-sm text-[var(--muted)]">Нет воронок. Создайте воронки в разделе Сделки.</p>}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => { setVisibilityModalOpen(false); setSelectedUser(null); setError(''); setSuccess('') }} className="btn-secondary text-sm">Отмена</button>
              <button type="button" onClick={handleSaveVisibility} disabled={updating} className="btn-primary text-sm disabled:opacity-50">{updating ? 'Сохранение...' : 'Сохранить'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно выбора периода оплаты */}
      {selectedPlanId && (
        <PaymentPeriodModal
          isOpen={paymentPeriodModalOpen}
          onClose={() => {
            setPaymentPeriodModalOpen(false)
            setSelectedPlanId(null)
            setSelectedPlanName('')
          }}
          planId={selectedPlanId}
          planName={selectedPlanName}
          onConfirm={handlePaymentWithPeriod}
          isLegalEntity={isLegalEntity}
        />
      )}
    </div>
  )
}
