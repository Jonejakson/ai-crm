export function isOwner(email?: string | null) {
  if (!email) return false
  const defaultOwners = ['info@flamecrm.ru', 'info@flame']
  const list = [
    process.env.OWNER_EMAILS,
    process.env.OWNERS_EMAILS,
    process.env.NEXT_PUBLIC_OWNER_EMAILS,
    defaultOwners.join(','),
  ]
    .filter(Boolean)
    .join(',')
  const owners = list
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return owners.includes(email.toLowerCase())
}


