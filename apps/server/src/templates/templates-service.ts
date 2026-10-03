// Шаблоны — последовательности этапов из библиотеки (PLAN.md §3.1, §3.5).
import type {
  createTemplateRequestSchema,
  RoleRef,
  Template,
  updateTemplateRequestSchema,
} from '@webmotiv/shared';
import { asc, count, eq, inArray } from 'drizzle-orm';
import type { z } from 'zod';
import type { AppDb, Tx } from '../db/db.ts';
import { orders, roles, stages, templates, templateStages } from '../db/schema.ts';
import { recordEvent } from '../events/event-log.ts';
import { fieldError, HttpError, notFound } from '../http/errors.ts';
import type { Actor } from '../users/users-service.ts';

type CreateTemplateInput = z.output<typeof createTemplateRequestSchema>;
type UpdateTemplateInput = z.output<typeof updateTemplateRequestSchema>;
type TemplateRow = typeof templates.$inferSelect;

const sameName = (a: string, b: string) =>
  a.trim().toLocaleLowerCase('ru') === b.trim().toLocaleLowerCase('ru');

function findActiveByName(tx: Tx | AppDb, name: string, exceptId?: number) {
  return tx
    .select()
    .from(templates)
    .all()
    .find(
      (template) =>
        template.archivedAt === null && template.id !== exceptId && sameName(template.name, name),
    );
}

/** Названия этапов по id в заданном порядке; несуществующий или архивный — ошибка формы. */
function requireActiveStages(tx: Tx, stageIds: number[]): string[] {
  const found = new Map(
    tx
      .select()
      .from(stages)
      .where(inArray(stages.id, stageIds))
      .all()
      .map((stage) => [stage.id, stage]),
  );
  return stageIds.map((id) => {
    const stage = found.get(id);
    if (!stage) throw fieldError('stageIds', 'Этап не найден — возможно, его удалили');
    if (stage.archivedAt !== null) throw fieldError('stageIds', `Этап «${stage.name}» в архиве`);
    return stage.name;
  });
}

function setStages(tx: Tx, templateId: number, stageIds: number[]): void {
  tx.delete(templateStages).where(eq(templateStages.templateId, templateId)).run();
  tx.insert(templateStages)
    .values(stageIds.map((stageId, position) => ({ templateId, stageId, position })))
    .run();
}

function stageNamesOf(tx: Tx, templateId: number): string[] {
  return tx
    .select({ name: stages.name })
    .from(templateStages)
    .innerJoin(stages, eq(stages.id, templateStages.stageId))
    .where(eq(templateStages.templateId, templateId))
    .orderBy(asc(templateStages.position))
    .all()
    .map((stage) => stage.name);
}

export class TemplatesService {
  private readonly db: AppDb;

  constructor(db: AppDb) {
    this.db = db;
  }

  list(): Template[] {
    const rows = this.db.select().from(templates).orderBy(asc(templates.name)).all();
    return this.toTemplates(rows);
  }

  get(id: number): Template {
    const row = this.db.select().from(templates).where(eq(templates.id, id)).get();
    const [template] = row ? this.toTemplates([row]) : [];
    if (!template) throw notFound('Шаблон не найден');
    return template;
  }

  create(input: CreateTemplateInput, actor: Actor): Template {
    const id = this.db.transaction((tx) => {
      if (findActiveByName(tx, input.name)) throw fieldError('name', 'Такой шаблон уже есть');
      const stageNames = requireActiveStages(tx, input.stageIds);
      const now = new Date();
      const template = tx
        .insert(templates)
        .values({
          name: input.name,
          description: input.description,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();
      setStages(tx, template.id, input.stageIds);
      recordEvent(tx, {
        actorId: actor.id,
        action: 'template.created',
        entityType: 'template',
        entityId: template.id,
        ip: actor.ip,
        payload: { name: template.name, stages: stageNames },
      });
      return template.id;
    });
    return this.get(id);
  }

  update(id: number, input: UpdateTemplateInput, actor: Actor): Template {
    this.db.transaction((tx) => {
      const current = tx.select().from(templates).where(eq(templates.id, id)).get();
      if (!current) throw notFound('Шаблон не найден');
      const { archived, ...edits } = input;
      const hasEdits = Object.values(edits).some((value) => value !== undefined);

      if (archived !== undefined && hasEdits) {
        throw new HttpError(422, 'Архивирование — отдельным запросом, без других правок.');
      }
      if (archived === true && current.archivedAt === null) {
        return this.setArchived(tx, current, true, actor);
      }
      if (archived === false && current.archivedAt !== null) {
        return this.setArchived(tx, current, false, actor);
      }
      if (!hasEdits) return;
      if (current.archivedAt !== null) {
        throw new HttpError(409, 'Шаблон в архиве — чтобы изменить его, сначала восстановите.');
      }

      const patch: Partial<typeof templates.$inferInsert> = {};
      const changes: Record<string, unknown> = {};
      if (edits.name !== undefined && edits.name !== current.name) {
        if (findActiveByName(tx, edits.name, id)) throw fieldError('name', 'Такой шаблон уже есть');
        patch.name = edits.name;
        changes.name = { from: current.name, to: edits.name };
      }
      if (edits.description !== undefined && edits.description !== current.description) {
        patch.description = edits.description;
        changes.description = true;
      }
      if (edits.stageIds !== undefined) {
        const before = stageNamesOf(tx, id);
        const currentIds = tx
          .select({ id: templateStages.stageId })
          .from(templateStages)
          .where(eq(templateStages.templateId, id))
          .orderBy(asc(templateStages.position))
          .all()
          .map((row) => row.id);
        if (currentIds.join() !== edits.stageIds.join()) {
          const after = requireActiveStages(tx, edits.stageIds);
          setStages(tx, id, edits.stageIds);
          changes.stages = { from: before, to: after };
        }
      }
      if (Object.keys(patch).length === 0 && changes.stages === undefined) return;

      tx.update(templates)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(templates.id, id))
        .run();
      recordEvent(tx, {
        actorId: actor.id,
        action: 'template.updated',
        entityType: 'template',
        entityId: id,
        ip: actor.ip,
        payload: { name: patch.name ?? current.name, changes },
      });
    });
    return this.get(id);
  }

  /** Удалить можно только шаблон, по которому ещё нет заказов. */
  delete(id: number, actor: Actor): void {
    this.db.transaction((tx) => {
      const template = tx.select().from(templates).where(eq(templates.id, id)).get();
      if (!template) throw notFound('Шаблон не найден');
      const used =
        tx.select({ count: count() }).from(orders).where(eq(orders.templateId, id)).get()?.count ??
        0;
      if (used > 0) {
        throw new HttpError(
          409,
          'По шаблону уже есть заказы — его можно только отправить в архив.',
        );
      }
      // Этапы шаблона удаляются каскадом; сами этапы остаются в библиотеке.
      tx.delete(templates).where(eq(templates.id, id)).run();
      recordEvent(tx, {
        actorId: actor.id,
        action: 'template.deleted',
        entityType: 'template',
        entityId: id,
        ip: actor.ip,
        payload: { name: template.name },
      });
    });
  }

  private setArchived(tx: Tx, template: TemplateRow, archived: boolean, actor: Actor): void {
    if (!archived) {
      if (findActiveByName(tx, template.name, template.id)) {
        throw new HttpError(
          409,
          `Уже есть действующий шаблон «${template.name}» — переименуйте один из них.`,
        );
      }
      // Пока шаблон лежал в архиве, его этапы могли тоже уйти в архив.
      const archivedStages = tx
        .select({ name: stages.name, archivedAt: stages.archivedAt })
        .from(templateStages)
        .innerJoin(stages, eq(stages.id, templateStages.stageId))
        .where(eq(templateStages.templateId, template.id))
        .all()
        .filter((stage) => stage.archivedAt !== null);
      if (archivedStages.length > 0) {
        throw new HttpError(
          409,
          `В шаблоне есть архивные этапы: ${archivedStages.map((s) => `«${s.name}»`).join(', ')}. ` +
            'Сначала восстановите их.',
        );
      }
    }
    const now = new Date();
    tx.update(templates)
      .set({ archivedAt: archived ? now : null, updatedAt: now })
      .where(eq(templates.id, template.id))
      .run();
    recordEvent(tx, {
      actorId: actor.id,
      action: archived ? 'template.archived' : 'template.restored',
      entityType: 'template',
      entityId: template.id,
      ip: actor.ip,
      payload: { name: template.name },
    });
  }

  private toTemplates(rows: TemplateRow[]): Template[] {
    const roleNames = new Map<number, RoleRef>(
      this.db
        .select({ id: roles.id, name: roles.name })
        .from(roles)
        .all()
        .map((role) => [role.id, role]),
    );
    const stagesByTemplate = new Map<number, Template['stages']>();
    for (const row of this.db
      .select({ templateId: templateStages.templateId, stage: stages })
      .from(templateStages)
      .innerJoin(stages, eq(stages.id, templateStages.stageId))
      .orderBy(asc(templateStages.templateId), asc(templateStages.position))
      .all()) {
      const list = stagesByTemplate.get(row.templateId) ?? [];
      list.push({
        id: row.stage.id,
        name: row.stage.name,
        executor: row.stage.executor,
        executorRole:
          row.stage.executorRoleId === null
            ? null
            : (roleNames.get(row.stage.executorRoleId) ?? null),
        fieldCount: row.stage.fields.length,
        archived: row.stage.archivedAt !== null,
      });
      stagesByTemplate.set(row.templateId, list);
    }
    const orderCounts = new Map(
      this.db
        .select({ templateId: orders.templateId, count: count() })
        .from(orders)
        .groupBy(orders.templateId)
        .all()
        .map((row) => [row.templateId, row.count]),
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      stages: stagesByTemplate.get(row.id) ?? [],
      archived: row.archivedAt !== null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      orderCount: orderCounts.get(row.id) ?? 0,
    }));
  }
}
