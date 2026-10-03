// Сессии входа (PLAN.md §7.1): случайный 256-битный токен в cookie, в БД — только его SHA-256.
// Срок — по бездействию и абсолютный: вход как минимум раз в рабочий день.
import { createHash, randomBytes } from 'node:crypto';
import type { Permission, RoleRef, SessionInfo } from '@webmotiv/shared';
import { and, asc, desc, eq, inArray, lte, ne, or } from 'drizzle-orm';
import type { AppDb, Tx } from '../db/db.ts';
import { roles, sessions, userRoles, users } from '../db/schema.ts';

export interface SessionLifetime {
  idleMs: number;
  absoluteMs: number;
}

/** Кто сделал запрос и что ему можно. Права читаются из БД на каждый запрос. */
export interface AuthContext {
  sessionId: string;
  user: { id: number; login: string; fullName: string; mustChangePassword: boolean };
  permissions: ReadonlySet<Permission>;
  roles: RoleRef[];
}

/** Продлевать сессию не чаще раза в минуту — иначе запись в БД на каждый запрос. */
const TOUCH_INTERVAL_MS = 60_000;
const USER_AGENT_MAX = 300;

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Роли сотрудников и объединение их прав. */
export function loadAccess(
  db: AppDb | Tx,
  userIds: number[],
): Map<number, { roles: RoleRef[]; permissions: Set<Permission> }> {
  const result = new Map<number, { roles: RoleRef[]; permissions: Set<Permission> }>();
  for (const id of userIds) result.set(id, { roles: [], permissions: new Set() });
  if (userIds.length === 0) return result;
  const rows = db
    .select({
      userId: userRoles.userId,
      id: roles.id,
      name: roles.name,
      permissions: roles.permissions,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(inArray(userRoles.userId, userIds))
    .orderBy(asc(roles.name))
    .all();
  for (const row of rows) {
    const access = result.get(row.userId);
    if (!access) continue;
    access.roles.push({ id: row.id, name: row.name });
    for (const permission of row.permissions) access.permissions.add(permission);
  }
  return result;
}

export class SessionStore {
  private readonly db: AppDb;
  private readonly lifetime: SessionLifetime;

  constructor(db: AppDb, lifetime: SessionLifetime) {
    this.db = db;
    this.lifetime = lifetime;
  }

  create(
    userId: number,
    meta: { ip: string | null; userAgent: string | null },
    now = new Date(),
  ): { token: string; id: string; absoluteExpiresAt: Date } {
    const token = randomBytes(32).toString('base64url');
    const id = hashToken(token);
    const absoluteExpiresAt = new Date(now.getTime() + this.lifetime.absoluteMs);
    this.db
      .insert(sessions)
      .values({
        id,
        userId,
        createdAt: now,
        lastSeenAt: now,
        idleExpiresAt: this.idleExpiry(now, absoluteExpiresAt),
        absoluteExpiresAt,
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, USER_AGENT_MAX) ?? null,
      })
      .run();
    return { token, id, absoluteExpiresAt };
  }

  /** Сессия по токену из cookie: живая и у активного сотрудника — иначе `null`. */
  authenticate(token: string, now = new Date()): AuthContext | null {
    const id = hashToken(token);
    const row = this.db
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.id, id))
      .get();
    if (!row) return null;
    const { session, user } = row;
    if (session.idleExpiresAt <= now || session.absoluteExpiresAt <= now || !user.isActive) {
      this.delete(id);
      return null;
    }
    if (now.getTime() - session.lastSeenAt.getTime() >= TOUCH_INTERVAL_MS) {
      this.db
        .update(sessions)
        .set({ lastSeenAt: now, idleExpiresAt: this.idleExpiry(now, session.absoluteExpiresAt) })
        .where(eq(sessions.id, id))
        .run();
    }
    const access = loadAccess(this.db, [user.id]).get(user.id);
    return {
      sessionId: id,
      user: {
        id: user.id,
        login: user.login,
        fullName: user.fullName,
        mustChangePassword: user.mustChangePassword,
      },
      permissions: access?.permissions ?? new Set(),
      roles: access?.roles ?? [],
    };
  }

  /** Живые сеансы сотрудника, свежие — первыми. */
  list(userId: number, currentId: string | null, now = new Date()): SessionInfo[] {
    return this.db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.lastSeenAt))
      .all()
      .filter((session) => session.idleExpiresAt > now && session.absoluteExpiresAt > now)
      .map((session) => ({
        id: session.id,
        current: session.id === currentId,
        createdAt: session.createdAt.toISOString(),
        lastSeenAt: session.lastSeenAt.toISOString(),
        ip: session.ip,
        userAgent: session.userAgent,
      }));
  }

  /** Удаляет сеанс сотрудника; `false` — такого у него нет. */
  deleteOwn(userId: number, id: string): boolean {
    const result = this.db
      .delete(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.userId, userId)))
      .run();
    return result.changes > 0;
  }

  delete(id: string): void {
    this.db.delete(sessions).where(eq(sessions.id, id)).run();
  }

  deleteByToken(token: string): void {
    this.delete(hashToken(token));
  }

  /** Завершает все сеансы сотрудника (кроме `exceptId`); сколько было живых. */
  deleteForUser(db: AppDb | Tx, userId: number, exceptId?: string, now = new Date()): number {
    const alive = db
      .select({
        id: sessions.id,
        idle: sessions.idleExpiresAt,
        absolute: sessions.absoluteExpiresAt,
      })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), exceptId ? ne(sessions.id, exceptId) : undefined))
      .all()
      .filter((session) => session.idle > now && session.absolute > now).length;
    db.delete(sessions)
      .where(and(eq(sessions.userId, userId), exceptId ? ne(sessions.id, exceptId) : undefined))
      .run();
    return alive;
  }

  deleteExpired(now = new Date()): void {
    this.db
      .delete(sessions)
      .where(or(lte(sessions.idleExpiresAt, now), lte(sessions.absoluteExpiresAt, now)))
      .run();
  }

  private idleExpiry(now: Date, absoluteExpiresAt: Date): Date {
    return new Date(Math.min(now.getTime() + this.lifetime.idleMs, absoluteExpiresAt.getTime()));
  }
}
