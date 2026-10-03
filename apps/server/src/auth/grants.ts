// Никто не выдаёт права, которых нет у него самого: иначе сотрудник с правом «Управлять
// сотрудниками» назначил бы себе роль администратора, а с правом на роли — добавил бы своей роли
// любые права.
import { type Permission, PERMISSION_LABELS } from '@webmotiv/shared';
import { HttpError } from '../http/errors.ts';

/** Права того, кто действует; `all` — администратор сервера через CLI. */
export type ActorPermissions = ReadonlySet<Permission> | 'all';

export function missingPermissions(
  actor: ActorPermissions,
  permissions: readonly Permission[],
): Permission[] {
  if (actor === 'all') return [];
  return permissions.filter((permission) => !actor.has(permission));
}

/** Проверяет, что роль с такими правами можно назначать, снимать, удалять. */
export function assertCanGrantRole(
  actor: ActorPermissions,
  role: { name: string; permissions: readonly Permission[] },
): void {
  const missing = missingPermissions(actor, role.permissions);
  if (missing.length > 0) {
    throw new HttpError(
      403,
      `Роль «${role.name}» даёт права, которых нет у вас: ` +
        `${missing.map((permission) => PERMISSION_LABELS[permission]).join(', ')}.`,
    );
  }
}

export function assertCanGrantPermissions(
  actor: ActorPermissions,
  permissions: readonly Permission[],
): void {
  const missing = missingPermissions(actor, permissions);
  if (missing.length > 0) {
    throw new HttpError(
      403,
      `Нельзя выдать права, которых нет у вас: ` +
        `${missing.map((permission) => PERMISSION_LABELS[permission]).join(', ')}.`,
    );
  }
}
