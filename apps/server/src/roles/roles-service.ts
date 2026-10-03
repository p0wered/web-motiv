// Роли: должности и наборы прав (PLAN.md §5).
import {
  type createRoleRequestSchema,
  type Permission,
  PERMISSIONS,
  type Role,
  type updateRoleRequestSchema,
} from '@webmotiv/shared';
import { asc, count, eq } from 'drizzle-orm';
import type { z } from 'zod';
import { keepingAnAdmin } from '../auth/admins.ts';
import { assertCanGrantPermissions, assertCanGrantRole } from '../auth/grants.ts';
import type { AppDb, Tx } from '../db/db.ts';
import { orderStages, roles, stages, userRoles } from '../db/schema.ts';
import { recordEvent } from '../events/event-log.ts';
import { fieldError, HttpError, notFound } from '../http/errors.ts';
import type { Actor } from '../users/users-service.ts';

type CreateRoleInput = z.output<typeof createRoleRequestSchema>;
type UpdateRoleInput = z.output<typeof updateRoleRequestSchema>;

/** Права в порядке списка PERMISSIONS — чтобы сравнение и журнал не зависели от порядка. */
const sorted = (permissions: readonly Permission[]) =>
  PERMISSIONS.filter((permission) => permissions.includes(permission));

/** Роль с таким названием без учёта регистра. Сравнение в JS: lower() в SQLite не знает кириллицу. */
function findRoleByName(tx: Tx | AppDb, name: string) {
  const wanted = name.trim().toLocaleLowerCase('ru');
  return tx
    .select()
    .from(roles)
    .all()
    .find((role) => role.name.toLocaleLowerCase('ru') === wanted);
}

export class RolesService {
  private readonly db: AppDb;

  constructor(db: AppDb) {
    this.db = db;
  }

  list(): Role[] {
    const userCounts = new Map(
      this.db
        .select({ roleId: userRoles.roleId, count: count() })
        .from(userRoles)
        .groupBy(userRoles.roleId)
        .all()
        .map((row) => [row.roleId, row.count]),
    );
    const stageCounts = new Map(
      this.db
        .select({ roleId: stages.executorRoleId, count: count() })
        .from(stages)
        .groupBy(stages.executorRoleId)
        .all()
        .map((row) => [row.roleId, row.count]),
    );
    return this.db
      .select()
      .from(roles)
      .orderBy(asc(roles.name))
      .all()
      .map((role) => ({
        id: role.id,
        name: role.name,
        permissions: sorted(role.permissions),
        userCount: userCounts.get(role.id) ?? 0,
        stageCount: stageCounts.get(role.id) ?? 0,
      }));
  }

  get(id: number): Role {
    const role = this.list().find((item) => item.id === id);
    if (!role) throw notFound('Роль не найдена');
    return role;
  }

  create(input: CreateRoleInput, actor: Actor): Role {
    const id = this.db.transaction((tx) => {
      if (findRoleByName(tx, input.name)) throw fieldError('name', 'Такая роль уже есть');
      const now = new Date();
      const permissions = sorted(input.permissions);
      assertCanGrantPermissions(actor.permissions, permissions);
      const role = tx
        .insert(roles)
        .values({ name: input.name, permissions, createdAt: now, updatedAt: now })
        .returning()
        .get();
      recordEvent(tx, {
        actorId: actor.id,
        action: 'role.created',
        entityType: 'role',
        entityId: role.id,
        ip: actor.ip,
        payload: { name: role.name, permissions },
      });
      return role.id;
    });
    return this.get(id);
  }

  update(id: number, input: UpdateRoleInput, actor: Actor): Role {
    this.db.transaction((tx) => {
      const current = tx.select().from(roles).where(eq(roles.id, id)).get();
      if (!current) throw notFound('Роль не найдена');
      const patch: Partial<typeof roles.$inferInsert> = {};
      const changes: Record<string, unknown> = {};

      if (input.name !== undefined && input.name !== current.name) {
        const taken = findRoleByName(tx, input.name);
        if (taken && taken.id !== id) throw fieldError('name', 'Такая роль уже есть');
        patch.name = input.name;
        changes.name = { from: current.name, to: input.name };
      }
      if (input.permissions !== undefined) {
        const before = sorted(current.permissions);
        const after = sorted(input.permissions);
        const added = after.filter((permission) => !before.includes(permission));
        const removed = before.filter((permission) => !after.includes(permission));
        // Убрать или добавить можно только те права, что есть у вас самих.
        assertCanGrantPermissions(actor.permissions, [...added, ...removed]);
        if (added.length > 0 || removed.length > 0) {
          patch.permissions = after;
          changes.permissions = { added, removed };
        }
      }
      if (Object.keys(patch).length === 0) return;

      keepingAnAdmin(tx, () =>
        tx
          .update(roles)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(roles.id, id))
          .run(),
      );
      recordEvent(tx, {
        actorId: actor.id,
        action: 'role.updated',
        entityType: 'role',
        entityId: id,
        ip: actor.ip,
        payload: { name: patch.name ?? current.name, changes },
      });
    });
    return this.get(id);
  }

  delete(id: number, actor: Actor): void {
    this.db.transaction((tx) => {
      const role = tx.select().from(roles).where(eq(roles.id, id)).get();
      if (!role) throw notFound('Роль не найдена');
      const usedInStages =
        (tx.select({ count: count() }).from(stages).where(eq(stages.executorRoleId, id)).get()
          ?.count ?? 0) +
        (tx
          .select({ count: count() })
          .from(orderStages)
          .where(eq(orderStages.executorRoleId, id))
          .get()?.count ?? 0);
      assertCanGrantRole(actor.permissions, role);
      if (usedInStages > 0) {
        throw new HttpError(
          409,
          'Роль — исполнитель этапов. Сначала назначьте этим этапам другого исполнителя.',
        );
      }
      // Связи с сотрудниками удаляются каскадом — сотрудники просто теряют эту роль.
      keepingAnAdmin(tx, () => tx.delete(roles).where(eq(roles.id, id)).run());
      recordEvent(tx, {
        actorId: actor.id,
        action: 'role.deleted',
        entityType: 'role',
        entityId: id,
        ip: actor.ip,
        payload: { name: role.name },
      });
    });
  }
}
