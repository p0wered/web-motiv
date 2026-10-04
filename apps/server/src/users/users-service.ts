// Сотрудники: создание с временным паролем, правка, блокировка, сброс пароля, сеансы.
import type {
  createUserRequestSchema,
  updateUserRequestSchema,
  User,
  UserDetail,
} from '@webmotiv/shared';
import { and, asc, count, eq, gt, inArray, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { keepingAnAdmin } from '../auth/admins.ts';
import { type ActorPermissions, assertCanGrantRole } from '../auth/grants.ts';
import type { PasswordHasher } from '../auth/passwords.ts';
import { loadAccess, type SessionStore } from '../auth/session-store.ts';
import { generateTemporaryPassword } from '../auth/temporary-password.ts';
import type { AppDb, Tx } from '../db/db.ts';
import { roles, sessions, userRoles, users } from '../db/schema.ts';
import { recordEvent } from '../events/event-log.ts';
import { fieldError, HttpError, notFound } from '../http/errors.ts';

/** Кто выполняет действие: сотрудник из запроса или администратор сервера через CLI. */
export interface Actor {
  id: number | null;
  ip: string | null;
  permissions: ActorPermissions;
}

type CreateUserInput = z.output<typeof createUserRequestSchema>;
type UpdateUserInput = z.output<typeof updateUserRequestSchema>;

export function findUserByLogin(db: AppDb | Tx, login: string) {
  return db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.login})`, login.trim().toLowerCase()))
    .get();
}

export class UsersService {
  private readonly db: AppDb;
  private readonly hasher: PasswordHasher;
  private readonly sessions: SessionStore;

  constructor(db: AppDb, hasher: PasswordHasher, sessions: SessionStore) {
    this.db = db;
    this.hasher = hasher;
    this.sessions = sessions;
  }

  list(): User[] {
    const rows = this.db.select().from(users).orderBy(asc(users.fullName)).all();
    return this.toUsers(this.db, rows);
  }

  directory(): { id: number; fullName: string; isActive: boolean }[] {
    return this.db
      .select({ id: users.id, fullName: users.fullName, isActive: users.isActive })
      .from(users)
      .orderBy(asc(users.fullName))
      .all();
  }

  get(id: number): UserDetail {
    const row = this.db.select().from(users).where(eq(users.id, id)).get();
    if (!row) throw notFound('Сотрудник не найден');
    const [user] = this.toUsers(this.db, [row]);
    if (!user) throw notFound('Сотрудник не найден');
    return { ...user, sessions: this.sessions.list(id, null) };
  }

  async create(
    input: CreateUserInput,
    actor: Actor,
  ): Promise<{ user: User; temporaryPassword: string }> {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await this.hasher.hash(temporaryPassword);
    const user = this.db.transaction((tx) => {
      if (findUserByLogin(tx, input.login)) throw fieldError('login', 'Логин уже занят');
      const roleNames = this.requireRoles(tx, input.roleIds);
      this.assertCanGrant(tx, actor, input.roleIds);
      const now = new Date();
      const created = tx
        .insert(users)
        .values({
          login: input.login,
          fullName: input.fullName,
          passwordHash,
          mustChangePassword: true,
          createdAt: now,
        })
        .returning()
        .get();
      this.setRoles(tx, created.id, input.roleIds);
      recordEvent(tx, {
        actorId: actor.id,
        action: 'user.created',
        entityType: 'user',
        entityId: created.id,
        ip: actor.ip,
        payload: { login: created.login, fullName: created.fullName, roles: roleNames },
      });
      return created;
    });
    return { user: this.get(user.id), temporaryPassword };
  }

  update(id: number, input: UpdateUserInput, actor: Actor): User {
    this.db.transaction((tx) => {
      const current = tx.select().from(users).where(eq(users.id, id)).get();
      if (!current) throw notFound('Сотрудник не найден');
      const changes: Record<string, { from: unknown; to: unknown }> = {};

      keepingAnAdmin(tx, () => {
        const patch: Partial<typeof users.$inferInsert> = {};
        if (input.login !== undefined && input.login !== current.login) {
          const taken = findUserByLogin(tx, input.login);
          if (taken && taken.id !== id) throw fieldError('login', 'Логин уже занят');
          patch.login = input.login;
          changes.login = { from: current.login, to: input.login };
        }
        if (input.fullName !== undefined && input.fullName !== current.fullName) {
          patch.fullName = input.fullName;
          changes.fullName = { from: current.fullName, to: input.fullName };
        }
        if (input.isActive !== undefined && input.isActive !== current.isActive) {
          if (!input.isActive && actor.id === id) {
            throw new HttpError(409, 'Нельзя заблокировать самого себя.');
          }
          patch.isActive = input.isActive;
          changes.isActive = { from: current.isActive, to: input.isActive };
        }
        if (Object.keys(patch).length > 0) {
          tx.update(users).set(patch).where(eq(users.id, id)).run();
        }
        if (input.roleIds !== undefined) {
          const roleIds = input.roleIds;
          const current = loadAccess(tx, [id]).get(id)?.roles ?? [];
          const before = current.map((role) => role.name);
          const after = this.requireRoles(tx, roleIds);
          if (before.join('\n') !== after.join('\n')) {
            // И назначить, и снять можно только роль, все права которой есть у вас самих.
            const currentIds = current.map((role) => role.id);
            this.assertCanGrant(tx, actor, [
              ...roleIds.filter((roleId) => !currentIds.includes(roleId)),
              ...currentIds.filter((roleId) => !roleIds.includes(roleId)),
            ]);
            this.setRoles(tx, id, roleIds);
            changes.roles = { from: before, to: after };
          }
        }
      });

      if (changes.isActive?.to === false) this.sessions.deleteForUser(tx, id);
      if (Object.keys(changes).length > 0) {
        recordEvent(tx, {
          actorId: actor.id,
          action: 'user.updated',
          entityType: 'user',
          entityId: id,
          ip: actor.ip,
          payload: { login: input.login ?? current.login, changes },
        });
      }
    });
    return this.get(id);
  }

  /** Новый временный пароль: старый перестаёт работать, все сеансы завершаются. */
  async resetPassword(id: number, actor: Actor): Promise<string> {
    if (actor.id === id) throw new HttpError(409, 'Свой пароль меняйте в профиле.');
    const user = this.db.select().from(users).where(eq(users.id, id)).get();
    if (!user) throw notFound('Сотрудник не найден');
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await this.hasher.hash(temporaryPassword);
    this.db.transaction((tx) => {
      tx.update(users)
        .set({ passwordHash, mustChangePassword: true })
        .where(eq(users.id, id))
        .run();
      this.sessions.deleteForUser(tx, id);
      recordEvent(tx, {
        actorId: actor.id,
        action: 'user.password_reset',
        entityType: 'user',
        entityId: id,
        ip: actor.ip,
        payload: { login: user.login },
      });
    });
    return temporaryPassword;
  }

  terminateSessions(id: number, actor: Actor): number {
    const user = this.db.select().from(users).where(eq(users.id, id)).get();
    if (!user) throw notFound('Сотрудник не найден');
    return this.db.transaction((tx) => {
      const terminated = this.sessions.deleteForUser(tx, id);
      recordEvent(tx, {
        actorId: actor.id,
        action: 'user.sessions_terminated',
        entityType: 'user',
        entityId: id,
        ip: actor.ip,
        payload: { login: user.login, count: terminated },
      });
      return terminated;
    });
  }

  /** Названия ролей по id (по алфавиту); неизвестная роль — ошибка формы. */
  private requireRoles(tx: Tx, roleIds: number[]): string[] {
    if (roleIds.length === 0) return [];
    const found = tx
      .select({ id: roles.id, name: roles.name })
      .from(roles)
      .where(inArray(roles.id, roleIds))
      .orderBy(asc(roles.name))
      .all();
    if (found.length !== roleIds.length) throw fieldError('roleIds', 'Роль не найдена');
    return found.map((role) => role.name);
  }

  private assertCanGrant(tx: Tx, actor: Actor, roleIds: number[]): void {
    if (roleIds.length === 0) return;
    const found = tx.select().from(roles).where(inArray(roles.id, roleIds)).all();
    for (const role of found) assertCanGrantRole(actor.permissions, role);
  }

  private setRoles(tx: Tx, userId: number, roleIds: number[]): void {
    tx.delete(userRoles).where(eq(userRoles.userId, userId)).run();
    if (roleIds.length > 0) {
      tx.insert(userRoles)
        .values(roleIds.map((roleId) => ({ userId, roleId })))
        .run();
    }
  }

  private toUsers(db: AppDb | Tx, rows: (typeof users.$inferSelect)[]): User[] {
    const ids = rows.map((row) => row.id);
    const access = loadAccess(db, ids);
    const now = new Date();
    const sessionCounts = new Map(
      ids.length === 0
        ? []
        : db
            .select({ userId: sessions.userId, count: count() })
            .from(sessions)
            .where(
              and(
                inArray(sessions.userId, ids),
                gt(sessions.idleExpiresAt, now),
                gt(sessions.absoluteExpiresAt, now),
              ),
            )
            .groupBy(sessions.userId)
            .all()
            .map((row) => [row.userId, row.count]),
    );
    return rows.map((row) => ({
      id: row.id,
      login: row.login,
      fullName: row.fullName,
      isActive: row.isActive,
      mustChangePassword: row.mustChangePassword,
      roles: access.get(row.id)?.roles ?? [],
      createdAt: row.createdAt.toISOString(),
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      activeSessions: sessionCounts.get(row.id) ?? 0,
    }));
  }
}
