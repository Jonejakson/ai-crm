export function isOwner(email?: string | null) {
  if (!email) return false
  const list = process.env.OWNER_EMAILS || process.env.OWNERS_EMAILS || ''
  const owners = list
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return owners.includes(email.toLowerCase())
}


