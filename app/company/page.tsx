'use client'

import { useState, useEffect } from 'react'
import { PuzzleIcon, SearchIcon, UsersGroupIcon, EditIcon, TrashIcon, KeyIcon } from '@/components/Icons'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import WebFormsSection from './WebFormsSection'
import EmailIntegrationsSection from './EmailIntegrationsSection'
import WebhookIntegrationsSection from './WebhookIntegrationsSection'
import TelegramBotSection from './TelegramBotSection'
import WhatsAppSection from './WhatsAppSection'
import AdvertisingIntegrationsSection from './AdvertisingIntegrationsSection'
import MoyskladSection from './MoyskladSection'
import OneCSection from './OneCSection'
import MigrationSection from './MigrationSection'
import PaymentPeriodModal, { PaymentPeriod } from '@/components/PaymentPeriodModal'
import PaymentTypeModal from '@/components/PaymentTypeModal'

interface User {
  id: number
  email: string
  name: string
  role: string
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
  const [userSearch, setUserSearch] = useState('')
  
  // Модальные окна для оплаты
  const [periodModalOpen, setPeriodModalOpen] = useState(false)
  const [typeModalOpen, setTypeModalOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<PaymentPeriod | null>(null)
  const [selectedPeriodLabel, setSelectedPeriodLabel] = useState('')
  const [calculatedAmount, setCalculatedAmount] = useState(0)

  // Форма создания пользователя
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'manager' as 'user' | 'manager' | 'admin'
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
    role: 'manager' as 'user' | 'manager' | 'admin'
  })

  // Форма смены пароля
  const [passwordFormData, setPasswordFormData] = useState({
    password: '',
    confirmPassword: ''
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated') {
      // Проверяем, что пользователь админ
      if (session?.user?.role !== 'admin') {
        router.push('/')
        return
      }
      fetchUsers()
      fetchBilling()
    }
  }, [status, session, router])

  const fetchUsers = async () => {
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
  }

  const fetchBilling = async () => {
    setBillingLoading(true)
    setBillingError('')
    try {
      const [plansRes, subscriptionRes] = await Promise.all([
        fetch('/api/billing/plans'),
        fetch('/api/billing/subscription'),
      ])

      if (!plansRes.ok) {
        throw new Error('Не удалось загрузить список тарифов')
      }

      const plansData = await plansRes.json()
      setPlans(plansData.plans || [])

      if (subscriptionRes.ok) {
        const subscriptionData = await subscriptionRes.json()
        setSubscription(subscriptionData.subscription || null)
      } else if (subscriptionRes.status === 401 || subscriptionRes.status === 403) {
        setSubscription(null)
      }
    } catch (error: any) {
      console.error('Error fetching billing data:', error)
      setBillingError(error.message || 'Не удалось загрузить данные по тарифу')
    } finally {
      setBillingLoading(false)
    }
  }

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

  // Проверка, закончилась ли подписка
  const isSubscriptionExpired = () => {
    if (!subscription) return true
    if (subscription.status === 'CANCELED' || subscription.status === 'PAST_DUE') return true
    if (subscription.currentPeriodEnd) {
      return new Date(subscription.currentPeriodEnd) < new Date()
    }
    return false
  }

  // Расчет скидки и итоговой суммы
  const calculatePriceWithDiscount = (monthlyPrice: number, period: PaymentPeriod) => {
    const periods: Record<PaymentPeriod, { months: number; discount: number }> = {
      '1': { months: 1, discount: 0 },
      '3': { months: 3, discount: 5 },
      '6': { months: 6, discount: 10 },
      '12': { months: 12, discount: 20 },
    }
    const { months, discount } = periods[period]
    const total = monthlyPrice * months
    const discountAmount = (total * discount) / 100
    return total - discountAmount
  }

  // Получение метки периода
  const getPeriodLabel = (period: PaymentPeriod) => {
    const labels: Record<PaymentPeriod, string> = {
      '1': '1 месяц',
      '3': '3 месяца',
      '6': '6 месяцев',
      '12': '1 год',
    }
    return labels[period]
  }

  // Обработчик нажатия на кнопку плана
  const handlePlanButtonClick = (plan: Plan) => {
    setSelectedPlan(plan)
    setPeriodModalOpen(true)
  }

  // Обработчик выбора периода
  const handlePeriodSelect = (period: PaymentPeriod) => {
    if (!selectedPlan) return
    
    setSelectedPeriod(period)
    setSelectedPeriodLabel(getPeriodLabel(period))
    const amount = calculatePriceWithDiscount(selectedPlan.price, period)
    setCalculatedAmount(amount)
    setPeriodModalOpen(false)
    setTypeModalOpen(true)
  }

  // Обработчик выбора типа плательщика
  const handlePaymentTypeSelect = async (type: 'individual' | 'legal') => {
    if (!selectedPlan || !selectedPeriod) return

    setBillingError('')
    setBillingMessage('')
    setBillingLoading(true)
    setTypeModalOpen(false)

    try {
      const periods: Record<PaymentPeriod, number> = {
        '1': 1,
        '3': 3,
        '6': 6,
        '12': 12,
      }
      const months = periods[selectedPeriod]

      // Создаем платеж
      const paymentResponse = await fetch('/api/billing/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: selectedPlan.id,
          billingInterval: months === 12 ? 'YEARLY' : 'MONTHLY',
          months,
          amount: calculatedAmount,
          paymentType: type,
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

      // Если выбран физ лицо и есть URL для оплаты, перенаправляем
      if (type === 'individual' && paymentData.paymentUrl) {
        window.location.href = paymentData.paymentUrl
        return
      }

      // Если выбран юр лицо, скачиваем счет
      if (type === 'legal' && paymentData.invoiceId) {
        const pdfUrl = `/api/billing/invoice/${paymentData.invoiceId}/pdf`
        window.open(pdfUrl, '_blank')
        setBillingMessage('Счет сгенерирован. После оплаты администратор подтвердит платеж.')
        await fetchBilling()
        return
      }

      // Если платеж создан, но URL нет, обновляем подписку
      await fetchBilling()
      setBillingMessage('Платеж создан. Ожидаем подтверждения...')
    } catch (error: any) {
      console.error('Error processing payment:', error)
      setBillingError(error.message || 'Не удалось обработать платеж')
    } finally {
      setBillingLoading(false)
      setSelectedPlan(null)
      setSelectedPeriod(null)
      setSelectedPeriodLabel('')
      setCalculatedAmount(0)
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
        throw new Error(data.error || 'Ошибка создания пользователя')
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
      role: user.role as 'user' | 'manager' | 'admin'
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
      manager: 'Менеджер',
      user: 'Пользователь'
    }
    return names[role as keyof typeof names] || role
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

  if (session?.user?.role !== 'admin') {
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
        ? new Date(subscription.currentPeriodEnd).toLocaleDateString('ru-RU')
        : '—',
      note: subscription?.currentPeriodEnd ? 'Автопродление активно' : 'Ещё не настроено',
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
            {companyInfo?.name 
              ? 'Контролируйте доступ, роли и подписку Flame CRM из одного окна.'
              : 'Контролируйте доступ, роли и подписку Flame CRM из одного окна.'}
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
          <div className="text-sm text-[var(--muted)] text-left md:text-right">
            {subscription?.plan ? (
              <>
                <p className="text-lg font-semibold text-[var(--foreground)]">{formatPrice(subscription.plan)}</p>
                {subscription?.currentPeriodEnd && (
                  <span className="text-xs text-[var(--muted)]">
                    Продление: {new Date(subscription.currentPeriodEnd).toLocaleDateString('ru-RU')}
                  </span>
                )}
              </>
            ) : (
              <p>Нет активной подписки</p>
            )}
          </div>
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
                      <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-semibold border border-emerald-100">
                        14 дней бесплатно
                      </span>
                    </div>
                    <h3 className="text-2xl font-semibold text-[var(--foreground)]">{plan.name}</h3>
                    <p className="text-sm text-[var(--muted)]">
                      {plan.description || 'Полный функционал CRM без ограничений по модулям и доплат.'}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-semibold text-[var(--foreground)]">{formatPrice(plan)}</p>
                      <span className="text-xs text-[var(--muted)]">после пробного периода</span>
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
                  <button
                    onClick={() => handlePlanButtonClick(plan)}
                    disabled={isCurrent && !isSubscriptionExpired() || billingLoading}
                    className={`w-full rounded-2xl px-4 py-2 text-sm font-medium transition ${
                      isCurrent && !isSubscriptionExpired()
                        ? 'bg-green-50 text-green-700 border border-green-200 cursor-default'
                        : 'bg-[var(--primary)] text-white hover:opacity-90'
                    }`}
                  >
                    {isCurrent && !isSubscriptionExpired()
                      ? 'Текущий план'
                      : isCurrent && isSubscriptionExpired()
                      ? 'Продлить'
                      : 'Начать 14-дневный тест'}
                  </button>
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
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'user' | 'manager' | 'admin' })}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
              >
                <option value="user">Пользователь</option>
                <option value="manager">Менеджер</option>
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
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as 'user' | 'manager' | 'admin' })}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
                  >
                    <option value="user">Пользователь</option>
                    <option value="manager">Менеджер</option>
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

      {/* Раздел управления источниками сделок */}
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

      {/* Раздел управления типами сделок */}
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
      <EmailIntegrationsSection />
      <WebhookIntegrationsSection />
      <TelegramBotSection />
      <WhatsAppSection />
      <AdvertisingIntegrationsSection />
      <MoyskladSection />
      <OneCSection />
      <MigrationSection />

      {/* Модальное окно выбора периода оплаты */}
      {selectedPlan && (
        <PaymentPeriodModal
          isOpen={periodModalOpen}
          onClose={() => {
            setPeriodModalOpen(false)
            setSelectedPlan(null)
          }}
          onSelect={handlePeriodSelect}
          monthlyPrice={selectedPlan.price}
          planName={selectedPlan.name}
        />
      )}

      {/* Модальное окно выбора типа плательщика */}
      {selectedPeriod && (
        <PaymentTypeModal
          isOpen={typeModalOpen}
          onClose={() => {
            setTypeModalOpen(false)
            setSelectedPeriod(null)
            setSelectedPeriodLabel('')
            setCalculatedAmount(0)
          }}
          onSelect={handlePaymentTypeSelect}
          totalAmount={calculatedAmount}
          periodLabel={selectedPeriodLabel}
        />
      )}
    </div>
  )
}

// Обёртка для DealSourcesManager с кнопкой добавления
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

// Обёртка для DealTypesManager с кнопкой добавления
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

// Компонент для управления источниками сделок
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
    } catch (error) {
      console.error('Error fetching sources:', error)
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
    } catch (error) {
      console.error('Error fetching pipelines:', error)
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
    } catch (error) {
      setError('Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот источник?')) return

    try {
      const response = await fetch(`/api/deal-sources?id=${id}`, { method: 'DELETE' })
      if (response.ok) {
        await fetchSources()
      }
    } catch (error) {
      console.error('Error deleting source:', error)
    }
  }

  const handleEdit = (source: {id: number, name: string, pipelineId: number | null}) => {
    setCurrentEditingSource(source)
    setCurrentFormData({ name: source.name, pipelineId: source.pipelineId ? source.pipelineId.toString() : '' })
    setIsModalOpen(true)
  }

  if (loading) {
    return <div className="text-center py-4 text-[var(--muted)]">Загрузка...</div>
  }

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
                {source.pipeline && (
                  <p className="text-sm text-[var(--muted)]">Воронка: {source.pipeline.name}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(source)}
                  className="px-3 py-1 text-sm text-[var(--primary)] hover:bg-[var(--primary-soft)] rounded-lg transition-colors"
                >
                  Изменить
                </button>
                <button
                  onClick={() => handleDelete(source.id)}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]" onClick={() => setIsModalOpen(false)}>
          <div className="bg-[var(--surface)] rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                {currentEditingSource ? 'Изменить источник' : 'Добавить источник'}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  setCurrentEditingSource(null)
                  setCurrentFormData({ name: '', pipelineId: '' })
                  setError('')
                }}
                className="text-[var(--muted)] hover:text-[var(--foreground)] text-2xl leading-none"
              >
                ✕
              </button>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-[var(--error-soft)] border border-[var(--error)]/30 rounded-lg text-[var(--error)] text-sm">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Название *</label>
                <input
                  type="text"
                  value={currentFormData.name}
                  onChange={(e) => setCurrentFormData({ ...currentFormData, name: e.target.value })}
                  className="w-full p-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                  placeholder="Например: Авито, Сайт, Реклама"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Воронка (опционально)</label>
                <select
                  value={currentFormData.pipelineId}
                  onChange={(e) => setCurrentFormData({ ...currentFormData, pipelineId: e.target.value })}
                  className="w-full p-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                >
                  <option value="">Не привязывать</option>
                  {pipelines.map((pipeline) => (
                    <option key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[var(--muted)] mt-1">При выборе источника сделка автоматически попадёт в эту воронку</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false)
                  setCurrentEditingSource(null)
                  setCurrentFormData({ name: '', pipelineId: '' })
                  setError('')
                }}
                className="btn-secondary text-sm"
                disabled={saving}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

// Компонент для управления типами сделок
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

  useEffect(() => {
    fetchTypes()
  }, [])

  const fetchTypes = async () => {
    try {
      const response = await fetch('/api/deal-types')
      if (response.ok) {
        const data = await response.json()
        setTypes(data || [])
      }
    } catch (error) {
      console.error('Error fetching types:', error)
    } finally {
      setLoading(false)
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
      const url = '/api/deal-types'
      const method = currentEditingType ? 'PUT' : 'POST'
      const body = currentEditingType
        ? { id: currentEditingType.id, name: currentFormData.name }
        : { name: currentFormData.name }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        await fetchTypes()
        setIsModalOpen(false)
        setCurrentEditingType(null)
        setCurrentFormData({ name: '' })
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Ошибка сохранения')
      }
    } catch (error) {
      setError('Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот тип?')) return

    try {
      const response = await fetch(`/api/deal-types?id=${id}`, { method: 'DELETE' })
      if (response.ok) {
        await fetchTypes()
      }
    } catch (error) {
      console.error('Error deleting type:', error)
    }
  }

  const handleEdit = (type: {id: number, name: string}) => {
    setCurrentEditingType(type)
    setCurrentFormData({ name: type.name })
    setIsModalOpen(true)
  }

  if (loading) {
    return <div className="text-center py-4 text-[var(--muted)]">Загрузка...</div>
  }

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
                <button
                  onClick={() => handleEdit(type)}
                  className="px-3 py-1 text-sm text-[var(--primary)] hover:bg-[var(--primary-soft)] rounded-lg transition-colors"
                >
                  Изменить
                </button>
                <button
                  onClick={() => handleDelete(type.id)}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]" onClick={() => setIsModalOpen(false)}>
          <div className="bg-[var(--surface)] rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                {currentEditingType ? 'Изменить тип' : 'Добавить тип'}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  setCurrentEditingType(null)
                  setCurrentFormData({ name: '' })
                  setError('')
                }}
                className="text-[var(--muted)] hover:text-[var(--foreground)] text-2xl leading-none"
              >
                ✕
              </button>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-[var(--error-soft)] border border-[var(--error)]/30 rounded-lg text-[var(--error)] text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Название *</label>
              <input
                type="text"
                value={currentFormData.name}
                onChange={(e) => setCurrentFormData({ ...currentFormData, name: e.target.value })}
                className="w-full p-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                placeholder="Например: Продажа, Монтаж, Консультация"
              />
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false)
                  setCurrentEditingType(null)
                  setCurrentFormData({ name: '' })
                  setError('')
                }}
                className="btn-secondary text-sm"
                disabled={saving}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

