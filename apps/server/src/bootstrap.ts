// Первый запуск: роли по умолчанию и первый администратор (PLAN.md §5, §7.1).
import {
  fullNameSchema,
  loginSchema,
  type Permission,
  PERMISSIONS,
  passwordProblem,
} from '@webmotiv/shared';
import { count, eq } from 'drizzle-orm';
import type { PasswordHasher } from './auth/passwords.ts';
import type { AppDb } from './db/db.ts';
import { roles, userRoles, users } from './db/schema.ts';
import { recordEvent } from './events/event-log.ts';
import { findUserByLogin } from './users/users-service.ts';

export const ADMIN_ROLE = 'Администратор';

/** Роли по умолчанию; для демо «Видеть все заказы» есть у всех. */
const DEFAULT_ROLES: { name: string; permissions: readonly Permission[] }[] = [
  { name: ADMIN_ROLE, permissions: PERMISSIONS },
  {
    name: 'Руководитель',
    permissions: [
      'orders.create',
      'orders.view_all',
      'orders.manage',
      'templates.manage',
      'audit.view',
    ],
  },
  { name: 'Менеджер', permissions: ['orders.create', 'orders.view_all'] },
  { name: 'Бухгалтер', permissions: ['orders.view_all'] },
  { name: 'Закупщик', permissions: ['orders.view_all'] },
  { name: 'Склад', permissions: ['orders.view_all'] },
];

/** Создаёт роли по умолчанию, если ролей ещё нет совсем. */
export function ensureDefaultRoles(db: AppDb): boolean {
  const existing = db.select({ count: count() }).from(roles).get()?.count ?? 0;
  if (existing > 0) return false;
  const now = new Date();
  db.insert(roles)
    .values(
      DEFAULT_ROLES.map((role) => ({
        name: role.name,
        permissions: [...role.permissions],
        createdAt: now,
        updatedAt: now,
      })),
    )
    .run();
  return true;
}

export class BootstrapError extends Error {}

export interface AdminInput {
  login: string;
  fullName: string;
  password: string;
  /** Пароль из .env знает тот, кто разворачивал, — при первом входе его нужно сменить. */
  mustChangePassword: boolean;
}

/** Создаёт сотрудника с ролью «Администратор». */
export async function createAdmin(
  db: AppDb,
  hasher: PasswordHasher,
  input: AdminInput,
): Promise<number> {
  const login = loginSchema.safeParse(input.login);
  if (!login.success) {
    throw new BootstrapError(`Логин не подходит: ${login.error.issues[0]?.message ?? ''}.`);
  }
  const fullName = fullNameSchema.safeParse(input.fullName);
  if (!fullName.success) throw new BootstrapError('Укажите ФИО.');
  const problem = passwordProblem(input.password, { login: login.data });
  if (problem) throw new BootstrapError(`Пароль не подходит: ${problem}.`);
  if (findUserByLogin(db, login.data)) throw new BootstrapError('Логин уже занят.');
  ensureDefaultRoles(db);
  const passwordHash = await hasher.hash(input.password);
  return db.transaction((tx) => {
    const role = tx.select().from(roles).where(eq(roles.name, ADMIN_ROLE)).get();
    if (!role) throw new BootstrapError(`Нет роли «${ADMIN_ROLE}» — создайте её в интерфейсе.`);
    const user = tx
      .insert(users)
      .values({
        login: login.data,
        fullName: fullName.data,
        passwordHash,
        mustChangePassword: input.mustChangePassword,
        createdAt: new Date(),
      })
      .returning()
      .get();
    tx.insert(userRoles).values({ userId: user.id, roleId: role.id }).run();
    recordEvent(tx, {
      actorId: null,
      action: 'user.created',
      entityType: 'user',
      entityId: user.id,
      payload: { login: user.login, fullName: user.fullName, roles: [ADMIN_ROLE], via: 'setup' },
    });
    return user.id;
  });
}

export function hasUsers(db: AppDb): boolean {
  return (db.select({ count: count() }).from(users).get()?.count ?? 0) > 0;
}
