'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function CompanyPageMinimal() {
  const { data: session, status } = useSession()
  const router = useRouter()

  console.log('MINIMAL COMPANY PAGE RENDERED')
  console.log('Status:', status)
  console.log('Session:', session)

  if (status === 'loading') {
    return <div>Loading...</div>
  }

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>COMPANY PAGE - MINIMAL VERSION</h1>
      <p>Status: {status}</p>
      <p>Role: {session?.user?.role}</p>
      <p>Email: {session?.user?.email}</p>
      <p>CompanyId: {session?.user?.companyId}</p>
    </div>
  )
}

