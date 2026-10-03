// Библиотека этапов (PLAN.md §3.4–3.5): поля, исполнитель, архив. Правки действуют только на
// новые заказы — заказ хранит снимок этапов.
import type {
  createStageRequestSchema,
  RoleRef,
  Stage,
  StageExecutor,
  StageField,
  updateStageRequestSchema,
} from '@webmotiv/shared';
import { asc, count, eq, isNotNull } from 'drizzle-orm';
import type { z } from 'zod';
import type { AppDb, Tx } from '../db/db.ts';
import { orderStages, roles, stages, templates, templateStages } from '../db/schema.ts';
import { recordEvent } from '../events/event-log.ts';
import { fieldError, HttpError, notFound } from '../http/errors.ts';
import type { Actor } from '../users/users-service.ts';

type CreateStageInput = z.output<typeof createStageRequestSchema>;
type UpdateStageInput = z.output<typeof updateStageRequestSchema>;
type StageRow = typeof stages.$inferSelect;

const sameName = (a: string, b: string) =>
  a.trim().toLocaleLowerCase('ru') === b.trim().toLocaleLowerCase('ru');

/** Действующий этап с таким названием (без учёта регистра; в коде — lower() в SQLite не знает кириллицу). */
function findActiveByName(tx: Tx | AppDb, name: string, exceptId?: number): StageRow | undefined {
  return tx
    .select()
    .from(stages)
    .all()
    .find(
      (stage) => stage.archivedAt === null && stage.id !== exceptId && sameName(stage.name, name),
    );
}

function assertExecutor(tx: Tx, executor: StageExecutor, executorRoleId: number | null): void {
  if (executor !== 'role' || executorRoleId === null) return;
  const role = tx.select({ id: roles.id }).from(roles).where(eq(roles.id, executorRoleId)).get();
  if (!role) throw fieldError('executorRoleId', 'Роль не найдена');
}

/** Что поменялось в полях — для журнала: добавлены, удалены, изменены (по названиям). */
function fieldsDiff(before: StageField[], after: StageField[]) {
  const beforeById = new Map(before.map((field) => [field.id, field]));
  const afterIds = new Set(after.map((field) => field.id));
  const added = after.filter((field) => !beforeById.has(field.id)).map((field) => field.label);
  const removed = before.filter((field) => !afterIds.has(field.id)).map((field) => field.label);
  const changed = after
    .filter((field) => {
      const old = beforeById.get(field.id);
      return old && JSON.stringify(old) !== JSON.stringify(field);
    })
    .map((field) => field.label);
  const reordered =
    added.length === 0 &&
    removed.length === 0 &&
    before.map((field) => field.id).join() !== after.map((field) => field.id).join();
  return { added, removed, changed, reordered };
}

export class StagesService {
  private readonly db: AppDb;

  constructor(db: AppDb) {
    this.db = db;
  }

  /** Все этапы, действующие и архивные, по алфавиту. */
  list(): Stage[] {
    const rows = this.db.select().from(stages).orderBy(asc(stages.name)).all();
    return this.toStages(this.db, rows);
  }

  get(id: number): Stage {
    const row = this.db.select().from(stages).where(eq(stages.id, id)).get();
    if (!row) throw notFound('Этап не найден');
    const [stage] = this.toStages(this.db, [row]);
    if (!stage) throw notFound('Этап не найден');
    return stage;
  }

  create(input: CreateStageInput, actor: Actor): Stage {
    const id = this.db.transaction((tx) => {
      if (findActiveByName(tx, input.name)) throw fieldError('name', 'Такой этап уже есть');
      assertExecutor(tx, input.executor, input.executorRoleId);
      const now = new Date();
      const stage = tx
        .insert(stages)
        .values({
          name: input.name,
          description: input.description,
          executor: input.executor,
          executorRoleId: input.executor === 'role' ? input.executorRoleId : null,
          fields: input.fields,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();
      recordEvent(tx, {
        actorId: actor.id,
        action: 'stage.created',
        entityType: 'stage',
        entityId: stage.id,
        ip: actor.ip,
        payload: { name: stage.name, fields: stage.fields.map((field) => field.label) },
      });
      return stage.id;
    });
    return this.get(id);
  }

  update(id: number, input: UpdateStageInput, actor: Actor): Stage {
    this.db.transaction((tx) => {
      const current = tx.select().from(stages).where(eq(stages.id, id)).get();
      if (!current) throw notFound('Этап не найден');
      const { archived, ...edits } = input;
      const hasEdits = Object.values(edits).some((value) => value !== undefined);

      if (archived !== undefined && hasEdits) {
        throw new HttpError(422, 'Архивирование — отдельным запросом, без других правок.');
      }
      if (archived === true && current.archivedAt === null) return this.archive(tx, current, actor);
      if (archived === false && current.archivedAt !== null)
        return this.restore(tx, current, actor);
      if (!hasEdits) return;
      if (current.archivedAt !== null) {
        throw new HttpError(409, 'Этап в архиве — чтобы изменить его, сначала восстановите.');
      }

      const patch: Partial<typeof stages.$inferInsert> = {};
      const changes: Record<string, unknown> = {};
      if (edits.name !== undefined && edits.name !== current.name) {
        if (findActiveByName(tx, edits.name, id)) throw fieldError('name', 'Такой этап уже есть');
        patch.name = edits.name;
        changes.name = { from: current.name, to: edits.name };
      }
      if (edits.description !== undefined && edits.description !== current.description) {
        patch.description = edits.description;
        changes.description = true;
      }
      if (edits.executor !== undefined && edits.executorRoleId !== undefined) {
        const roleId = edits.executor === 'role' ? edits.executorRoleId : null;
        if (edits.executor !== current.executor || roleId !== current.executorRoleId) {
          assertExecutor(tx, edits.executor, roleId);
          patch.executor = edits.executor;
          patch.executorRoleId = roleId;
          changes.executor = {
            from: this.executorName(tx, current.executor, current.executorRoleId),
            to: this.executorName(tx, edits.executor, roleId),
          };
        }
      }
      if (edits.fields !== undefined) {
        const diff = fieldsDiff(current.fields, edits.fields);
        if (diff.added.length || diff.removed.length || diff.changed.length || diff.reordered) {
          patch.fields = edits.fields;
          changes.fields = diff;
        }
      }
      if (Object.keys(patch).length === 0) return;

      tx.update(stages)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(stages.id, id))
        .run();
      recordEvent(tx, {
        actorId: actor.id,
        action: 'stage.updated',
        entityType: 'stage',
        entityId: id,
        ip: actor.ip,
        payload: { name: patch.name ?? current.name, changes },
      });
    });
    return this.get(id);
  }

  /** Удалить можно только этап, которого нет ни в шаблонах, ни в заказах. */
  delete(id: number, actor: Actor): void {
    this.db.transaction((tx) => {
      const stage = tx.select().from(stages).where(eq(stages.id, id)).get();
      if (!stage) throw notFound('Этап не найден');
      const inTemplates = tx
        .select({ name: templates.name })
        .from(templateStages)
        .innerJoin(templates, eq(templates.id, templateStages.templateId))
        .where(eq(templateStages.stageId, id))
        .all();
      if (inTemplates.length > 0) {
        throw new HttpError(
          409,
          `Этап входит в шаблоны: ${inTemplates.map((t) => `«${t.name}»`).join(', ')}. ` +
            'Уберите его оттуда или отправьте этап в архив.',
        );
      }
      const inOrders =
        tx
          .select({ count: count() })
          .from(orderStages)
          .where(eq(orderStages.sourceStageId, id))
          .get()?.count ?? 0;
      if (inOrders > 0) {
        throw new HttpError(409, 'Этап уже есть в заказах — его можно только отправить в архив.');
      }
      tx.delete(stages).where(eq(stages.id, id)).run();
      recordEvent(tx, {
        actorId: actor.id,
        action: 'stage.deleted',
        entityType: 'stage',
        entityId: id,
        ip: actor.ip,
        payload: { name: stage.name },
      });
    });
  }

  /** В архив — только если этап не входит в действующие шаблоны: иначе шаблон сломается. */
  private archive(tx: Tx, stage: StageRow, actor: Actor): void {
    const activeTemplates = tx
      .select({ name: templates.name, archivedAt: templates.archivedAt })
      .from(templateStages)
      .innerJoin(templates, eq(templates.id, templateStages.templateId))
      .where(eq(templateStages.stageId, stage.id))
      .all()
      .filter((template) => template.archivedAt === null);
    if (activeTemplates.length > 0) {
      throw new HttpError(
        409,
        `Этап входит в шаблоны: ${activeTemplates.map((t) => `«${t.name}»`).join(', ')}. ` +
          'Сначала уберите его оттуда.',
      );
    }
    const now = new Date();
    tx.update(stages).set({ archivedAt: now, updatedAt: now }).where(eq(stages.id, stage.id)).run();
    recordEvent(tx, {
      actorId: actor.id,
      action: 'stage.archived',
      entityType: 'stage',
      entityId: stage.id,
      ip: actor.ip,
      payload: { name: stage.name },
    });
  }

  private restore(tx: Tx, stage: StageRow, actor: Actor): void {
    if (findActiveByName(tx, stage.name, stage.id)) {
      throw new HttpError(
        409,
        `Уже есть действующий этап «${stage.name}» — переименуйте один из них.`,
      );
    }
    tx.update(stages)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(eq(stages.id, stage.id))
      .run();
    recordEvent(tx, {
      actorId: actor.id,
      action: 'stage.restored',
      entityType: 'stage',
      entityId: stage.id,
      ip: actor.ip,
      payload: { name: stage.name },
    });
  }

  private executorName(tx: Tx, executor: StageExecutor, roleId: number | null): string {
    if (executor === 'responsible') return 'Ответственный по заказу';
    if (roleId === null) return '—';
    return (
      tx.select({ name: roles.name }).from(roles).where(eq(roles.id, roleId)).get()?.name ?? '—'
    );
  }

  private toStages(db: AppDb | Tx, rows: StageRow[]): Stage[] {
    const roleNames = new Map<number, RoleRef>(
      db
        .select({ id: roles.id, name: roles.name })
        .from(roles)
        .all()
        .map((role) => [role.id, role]),
    );
    const usage = new Map<number, Stage['templates']>();
    for (const row of db
      .select({
        stageId: templateStages.stageId,
        id: templates.id,
        name: templates.name,
        archivedAt: templates.archivedAt,
      })
      .from(templateStages)
      .innerJoin(templates, eq(templates.id, templateStages.templateId))
      .orderBy(asc(templates.name))
      .all()) {
      const list = usage.get(row.stageId) ?? [];
      list.push({ id: row.id, name: row.name, archived: row.archivedAt !== null });
      usage.set(row.stageId, list);
    }
    const orderCounts = new Map(
      db
        .select({ stageId: orderStages.sourceStageId, count: count() })
        .from(orderStages)
        .where(isNotNull(orderStages.sourceStageId))
        .groupBy(orderStages.sourceStageId)
        .all()
        .map((row) => [row.stageId, row.count]),
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      executor: row.executor,
      executorRole:
        row.executorRoleId === null ? null : (roleNames.get(row.executorRoleId) ?? null),
      fields: row.fields,
      archived: row.archivedAt !== null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      templates: usage.get(row.id) ?? [],
      orderCount: orderCounts.get(row.id) ?? 0,
    }));
  }
}
