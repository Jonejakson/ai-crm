/**
 * Система прав доступа по ролям и переопределениям для пользователей.
 * Сущности: contacts, deals, tasks, events
 * Действия: create, edit, delete
 */

export type EntityType = 'contacts' | 'deals' | 'tasks' | 'events'
export type PermissionAction = 'create' | 'edit' | 'delete'

export interface EntityPermissions {
  create: boolean
  edit: boolean
  delete: boolean
}

export type RolePermissions = Record<EntityType, EntityPermissions>
export type RolePermissionsMap = Record<string, RolePermissions>

const DEFAULT_ROLE_PERMISSIONS: RolePermissionsMap = {
  admin: {
    contacts: { create: true, edit: true, delete: true },
    deals: { create: true, edit: true, delete: true },
    tasks: { create: true, edit: true, delete: true },
    events: { create: true, edit: true, delete: true },
  },
  department_head: {
    contacts: { create: true, edit: true, delete: true },
    deals: { create: true, edit: true, delete: true },
    tasks: { create: true, edit: true, delete: true },
    events: { create: true, edit: true, delete: true },
  },
  manager: {
    contacts: { create: true, edit: true, delete: false },
    deals: { create: true, edit: true, delete: false },
    tasks: { create: true, edit: true, delete: false },
    events: { create: true, edit: true, delete: false },
  },
  user: {
    contacts: { create: true, edit: true, delete: false },
    deals: { create: true, edit: true, delete: false },
    tasks: { create: true, edit: true, delete: false },
    events: { create: true, edit: true, delete: false },
  },
}

const ENTITIES: EntityType[] = ['contacts', 'deals', 'tasks', 'events']
const ACTIONS: PermissionAction[] = ['create', 'edit', 'delete']

export function getDefaultRolePermissions(): RolePermissionsMap {
  return JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS))
}

export function getEmptyEntityPermissions(): EntityPermissions {
  return { create: false, edit: false, delete: false }
}

export function getEmptyRolePermissions(): RolePermissions {
  return {
    contacts: getEmptyEntityPermissions(),
    deals: getEmptyEntityPermissions(),
    tasks: getEmptyEntityPermissions(),
    events: getEmptyEntityPermissions(),
  }
}

export function mergePermissions(
  rolePerms: RolePermissions,
  userOverride: Partial<RolePermissions> | null
): RolePermissions {
  if (!userOverride) return rolePerms
  const result = { ...rolePerms }
  for (const entity of ENTITIES) {
    if (userOverride[entity]) {
      result[entity] = { ...result[entity], ...userOverride[entity] }
    }
  }
  return result
}

/**
 * Получить эффективные права пользователя.
 * Админ всегда имеет все права.
 */
export function getEffectivePermissions(
  role: string,
  companyRolePermissions: RolePermissionsMap | null,
  userPermissions: Partial<RolePermissions> | null
): RolePermissions {
  if (role === 'admin' || role === 'owner') {
    return DEFAULT_ROLE_PERMISSIONS.admin
  }
  const roleDefaults = companyRolePermissions?.[role] ?? DEFAULT_ROLE_PERMISSIONS[role] ?? DEFAULT_ROLE_PERMISSIONS.user
  return mergePermissions(roleDefaults, userPermissions)
}

export function canPerform(
  effectivePerms: RolePermissions,
  entity: EntityType,
  action: PermissionAction
): boolean {
  return effectivePerms[entity]?.[action] ?? false
}

/**
 * Проверить право текущего пользователя на действие (для использования в API).
 * Возвращает true если разрешено, false если запрещено.
 */
export async function checkPermission(
  entity: EntityType,
  action: PermissionAction
): Promise<boolean> {
  const { getCurrentUser } = await import('./get-session')
  const prisma = (await import('./prisma')).default

  const user = await getCurrentUser()
  if (!user) return false

  if (user.role === 'admin' || user.role === 'owner') return true

  const companyId = parseInt(user.companyId)
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { rolePermissions: true },
  })
  const userRecord = await prisma.user.findUnique({
    where: { id: parseInt(user.id) },
    select: { role: true, permissions: true },
  })
  if (!userRecord) return false

  const effective = getEffectivePermissions(
    userRecord.role,
    company?.rolePermissions as RolePermissionsMap | null,
    userRecord.permissions as Partial<RolePermissions> | null
  )
  return canPerform(effective, entity, action)
}

export { ENTITIES, ACTIONS }
