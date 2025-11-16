import { auth } from "./auth"

export async function getSession() {
  return await auth()
}

export async function getCurrentUser() {
  try {
    const session = await getSession()
    return session?.user || null
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

export function getUserId(user: { id: string | number } | null | undefined): number | null {
  if (!user || !user.id) {
    return null
  }
  const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id
  return isNaN(userId) ? null : userId
}

