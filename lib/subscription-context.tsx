'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useSession } from 'next-auth/react'

type SubscriptionContextType = {
  /** true = подписка активна, false = истекла/нет, null = ещё загружается */
  subscriptionActive: boolean | null
}

const SubscriptionContext = createContext<SubscriptionContextType>({ subscriptionActive: null })

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const [subscriptionActive, setSubscriptionActive] = useState<boolean | null>(null)

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) {
      setSubscriptionActive(null)
      return
    }

    const fetchActive = async () => {
      try {
        const res = await fetch('/api/billing/subscription-active')
        if (res.ok) {
          const data = await res.json()
          setSubscriptionActive(data.active === true)
        } else {
          setSubscriptionActive(false)
        }
      } catch {
        setSubscriptionActive(false)
      }
    }

    fetchActive()
  }, [session?.user, status])

  return (
    <SubscriptionContext.Provider value={{ subscriptionActive }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  return useContext(SubscriptionContext)
}
