import { getCurrentUser } from "./get-session";

/**
 * Утилита для контроля доступа к данным
 * - owner: видит все данные всех компаний (супер-админ)
 * - admin: видит все данные своей компании
 * - manager: видит только свои данные
 * - user: видит только свои данные
 */

export interface AccessFilter {
  companyId?: number; // undefined для owner (видит все компании)
  userId?: number; // Только для manager/user, undefined для admin/owner
}

/**
 * Получить фильтр доступа для текущего пользователя
 */
export async function getAccessFilter(): Promise<AccessFilter | null> {
  const user = await getCurrentUser();
  
  if (!user) {
    return null;
  }

  const companyId = parseInt(user.companyId);
  const userId = parseInt(user.id);

  // Owner видит все компании (без фильтра)
  if (user.role === 'owner') {
    return {
      // companyId и userId не указываем, чтобы видеть все данные
    };
  }

  // Админ видит всю компанию
  if (user.role === 'admin') {
    return {
      companyId,
      // userId не указываем, чтобы видеть все данные компании
    };
  }

  // Менеджер и обычный пользователь видят только свои данные
  return {
    companyId,
    userId,
  };
}

/**
 * Получить условие WHERE для Prisma запросов
 */
export async function getWhereCondition() {
  const filter = await getAccessFilter();
  
  if (!filter) {
    throw new Error('Unauthorized');
  }

  // Для owner: без фильтра (видит все)
  if (!filter.companyId) {
    return {};
  }

  // Для админа: фильтр по компании
  if (!filter.userId) {
    return {
      user: {
        companyId: filter.companyId,
      },
    };
  }

  // Для менеджера/пользователя: фильтр по компании И пользователю
  return {
    user: {
      companyId: filter.companyId,
      id: filter.userId,
    },
  };
}

/**
 * Получить условие WHERE для прямых запросов (когда userId уже есть в модели)
 * Используется для: Contact, Task, Deal, Event
 */
export async function getDirectWhereCondition() {
  const filter = await getAccessFilter();
  
  if (!filter) {
    throw new Error('Unauthorized');
  }

  // Для owner: без фильтра (видит все)
  if (!filter.companyId) {
    return {};
  }

  // Для менеджера/пользователя: только свой userId
  if (filter.userId) {
    return {
      userId: filter.userId,
    };
  }

  // Для админа нужно получить все userId компании
  const prisma = (await import('./prisma')).default;
  const users = await prisma.user.findMany({
    where: { companyId: filter.companyId },
    select: { id: true },
  });
  const userIds = users.map(u => u.id);

  return {
    userId: {
      in: userIds,
    },
  };
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

