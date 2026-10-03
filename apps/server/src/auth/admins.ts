// Защита от блокировки системы (PLAN.md §5): в системе всегда остаётся хотя бы один активный
// администратор — сотрудник с правами и на сотрудников, и на роли.
import type { Permission } from '@webmotiv/shared';
import { eq } from 'drizzle-orm';
import type { Tx } from '../db/db.ts';
import { roles, userRoles, users } from '../db/schema.ts';
import { HttpError } from '../http/errors.ts';

export const ADMIN_PERMISSIONS: readonly Permission[] = ['users.manage', 'roles.manage'];

export function countAdmins(tx: Tx): number {
  const rows = tx
    .select({ userId: userRoles.userId, permissions: roles.permissions })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(eq(users.isActive, true))
    .all();
  const byUser = new Map<number, Set<Permission>>();
  for (const row of rows) {
    const set = byUser.get(row.userId) ?? new Set<Permission>();
    for (const permission of row.permissions) set.add(permission);
    byUser.set(row.userId, set);
  }
  return [...byUser.values()].filter((set) => ADMIN_PERMISSIONS.every((p) => set.has(p))).length;
}

/**
 * Выполняет изменение внутри транзакции и проверяет, что администратор остался. Если был
 * хотя бы один, а стало ноль, — ошибка, и транзакция откатывается целиком.
 */
export function keepingAnAdmin<T>(tx: Tx, change: () => T): T {
  const before = countAdmins(tx);
  const result = change();
  if (before > 0 && countAdmins(tx) === 0) {
    throw new HttpError(
      409,
      'Так нельзя: в системе не останется ни одного администратора — сотрудника с правами ' +
        'на сотрудников и роли.',
    );
  }
  return result;
}
