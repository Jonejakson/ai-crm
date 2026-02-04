import { getCurrentUser } from "./get-session";

/**
 * Утилита для контроля доступа к данным
 * - owner: видит все данные всех компаний (супер-админ)
 * - admin: видит все данные своей компании (visibilityScope = 'all')
 * - department_head: видит данные по выбранным воронкам/отделам (visibilityScope = 'department')
 * - manager/user: видит только свои данные (visibilityScope = 'own')
 */

export type VisibilityScope = 'own' | 'department' | 'all';

export interface AccessFilter {
  companyId?: number;
  userId?: number;
  userIds?: number[];
  pipelineIds?: number[];
  scope: VisibilityScope;
}

/**
 * Получить фильтр доступа для текущего пользователя (с учётом visibilityScope и assignedPipelineIds)
 */
export async function getAccessFilter(): Promise<AccessFilter | null> {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return null;

  const companyId = parseInt(sessionUser.companyId);
  const userId = parseInt(sessionUser.id);

  // Owner видит все
  if (sessionUser.role === 'owner') {
    return { scope: 'all' };
  }

  const prisma = (await import('./prisma')).default;
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { visibilityScope: true, assignedPipelineIds: true, role: true },
  });

  const scope = (dbUser?.visibilityScope as VisibilityScope) || 
    (sessionUser.role === 'admin' ? 'all' : sessionUser.role === 'department_head' ? 'department' : 'own');
  const assignedPipelineIds = Array.isArray(dbUser?.assignedPipelineIds) 
    ? (dbUser.assignedPipelineIds as number[]).filter((n): n is number => typeof n === 'number')
    : [];

  // Админ по умолчанию видит всё (можно переопределить через visibilityScope)
  if (sessionUser.role === 'admin' && !dbUser?.visibilityScope) {
    return { companyId, scope: 'all' };
  }

  if (scope === 'own') {
    return { companyId, userId, scope: 'own' };
  }

  if (scope === 'all') {
    return { companyId, scope: 'all' };
  }

  // scope === 'department'
  if (assignedPipelineIds.length === 0) {
    // Нет выбранных воронок — видит только свои
    return { companyId, userId, scope: 'own' };
  }

  return { companyId, pipelineIds: assignedPipelineIds, scope: 'department' };
}

/**
 * Получить условие WHERE для Prisma запросов
 */
export async function getWhereCondition() {
  const filter = await getAccessFilter();
  if (!filter) throw new Error('Unauthorized');
  if (!filter.companyId) return {};
  if (filter.userId) {
    return { user: { companyId: filter.companyId, id: filter.userId } };
  }
  return { user: { companyId: filter.companyId } };
}

export type DirectWhereEntityType = 'deal' | 'contact' | 'task' | 'event';

/**
 * Получить условие WHERE для прямых запросов (Contact, Task, Deal, Event).
 * Для Deal при scope='department' фильтрует по pipelineId.
 * Для Contact/Task/Event при scope='department' фильтрует по userId (пользователи из выбранных воронок).
 */
export async function getDirectWhereCondition(entityType: DirectWhereEntityType = 'contact') {
  const filter = await getAccessFilter();
  if (!filter) throw new Error('Unauthorized');

  if (!filter.companyId && filter.scope === 'all') return {};

  if (filter.userId) {
    return { userId: filter.userId };
  }

  const prisma = (await import('./prisma')).default;

  if (filter.scope === 'department' && filter.pipelineIds && filter.pipelineIds.length > 0) {
    if (entityType === 'deal') {
      return { pipelineId: { in: filter.pipelineIds } };
    }
    // Для contact/task/event: пользователи, у которых есть пересечение assignedPipelineIds с filter.pipelineIds
    const users = await prisma.user.findMany({
      where: { companyId: filter.companyId! },
      select: { id: true, assignedPipelineIds: true },
    });
    const userIds = users.filter((u) => {
      const ids = Array.isArray(u.assignedPipelineIds) ? (u.assignedPipelineIds as number[]) : [];
      return ids.some((id) => filter.pipelineIds!.includes(id));
    }).map((u) => u.id);
    if (userIds.length === 0) return { userId: -1 }; // пустой результат
    return { userId: { in: userIds } };
  }

  // scope === 'all'
  const users = await prisma.user.findMany({
    where: { companyId: filter.companyId! },
    select: { id: true },
  });
  return { userId: { in: users.map((u) => u.id) } };
}

/**
 * Проверить, является ли пользователь owner (владельцем системы)
 */
export async function isOwner(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === 'owner';
}

/**
 * Проверить, является ли пользователь админом или owner
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === 'admin' || user?.role === 'owner';
}

/**
 * Проверить, является ли пользователь менеджером, админом или owner
 */
export async function isManagerOrAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === 'admin' || user?.role === 'manager' || user?.role === 'owner';
}

