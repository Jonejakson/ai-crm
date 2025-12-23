'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Modal from './Modal'

interface Plan {
  id: number
  name: string
  slug: string
  description: string | null
  price: number
  currency: string
}

interface SubscriptionRenewalModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SubscriptionRenewalModal({
  isOpen,
  onClose,
}: SubscriptionRenewalModalProps) {
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<1 | 3 | 6 | 12>(1)

  useEffect(() => {
    if (isOpen) {
      fetchPlans()
    }
  }, [isOpen])

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/billing/plans')
      if (response.ok) {
        const data = await response.json()
        setPlans(data.plans || [])
        if (data.plans && data.plans.length > 0) {
          setSelectedPlan(data.plans[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching plans:', error)
    }
  }

  const calculatePrice = (basePrice: number, period: number): number => {
    // Месячные тарифы поднимаем на 20%
    const monthlyPrice = basePrice * 1.2
    
    // Скидки: 3 месяца - 5%, 6 месяцев - 10%, 12 месяцев - 15%
    const discounts: Record<number, number> = {
      1: 0,
      3: 0.05,
      6: 0.10,
      12: 0.15,
    }
    
    const discount = discounts[period] || 0
    const totalPrice = monthlyPrice * period * (1 - discount)
    
    return Math.round(totalPrice)
  }

  const formatPrice = (price: number, currency: string = 'RUB') => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(price)
  }

  const handleRenew = async () => {
    if (!selectedPlan) return

    setLoading(true)
    try {
      const plan = plans.find(p => p.id === selectedPlan)
      if (!plan) return

      const totalPrice = calculatePrice(plan.price, selectedPeriod)

      const response = await fetch('/api/billing/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: selectedPlan,
          billingInterval: selectedPeriod === 12 ? 'YEARLY' : 'MONTHLY',
          periodMonths: selectedPeriod,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Ошибка при создании платежа')
        return
      }

      if (data.paymentUrl) {
        window.location.href = data.paymentUrl
      } else {
        // Подписка активирована (в режиме разработки)
        onClose()
        router.push('/company')
        router.refresh()
      }
    } catch (error) {
      console.error('Error renewing subscription:', error)
      alert('Ошибка при продлении подписки')
    } finally {
      setLoading(false)
    }
  }

  const selectedPlanData = plans.find(p => p.id === selectedPlan)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Продлить подписку"
      size="lg"
    >
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800 text-sm">
            Ваша подписка закончилась. Продлите подписку для продолжения работы с CRM.
          </p>
        </div>

        {plans.length > 0 && (
          <>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Выберите тариф
              </label>
              <div className="space-y-2">
                {plans.map((plan) => (
                  <label
                    key={plan.id}
                    className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition ${
                      selectedPlan === plan.id
                        ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                        : 'border-[var(--border)] hover:border-[var(--primary)]/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="plan"
                      value={plan.id}
                      checked={selectedPlan === plan.id}
                      onChange={() => setSelectedPlan(plan.id)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-[var(--foreground)]">{plan.name}</div>
                      {plan.description && (
                        <div className="text-sm text-[var(--muted)]">{plan.description}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Период оплаты
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 3, 6, 12].map((period) => {
                  const discount = period === 1 ? 0 : period === 3 ? 5 : period === 6 ? 10 : 15
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setSelectedPeriod(period as 1 | 3 | 6 | 12)}
                      className={`p-3 border-2 rounded-xl transition ${
                        selectedPeriod === period
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                          : 'border-[var(--border)] hover:border-[var(--primary)]/50'
                      }`}
                    >
                      <div className="font-semibold text-[var(--foreground)]">
                        {period} {period === 1 ? 'месяц' : period < 5 ? 'месяца' : 'месяцев'}
                      </div>
                      {discount > 0 && (
                        <div className="text-xs text-green-600 font-medium">Скидка {discount}%</div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {selectedPlanData && (
              <div className="bg-[var(--background-soft)] rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--muted)]">Итого к оплате:</span>
                  <span className="text-2xl font-bold text-[var(--foreground)]">
                    {formatPrice(calculatePrice(selectedPlanData.price, selectedPeriod), selectedPlanData.currency)}
                  </span>
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  {selectedPeriod === 1 && 'Цена за месяц (с учетом надбавки 20%)'}
                  {selectedPeriod > 1 && `Цена за ${selectedPeriod} месяцев со скидкой`}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1"
                disabled={loading}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleRenew}
                disabled={loading || !selectedPlan}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Обработка...' : 'Продлить подписку'}
              </button>
            </div>
          </>
        )}

        {plans.length === 0 && (
          <div className="text-center py-8 text-[var(--muted)]">
            Загрузка тарифов...
          </div>
        )}
      </div>
    </Modal>
  )
}


