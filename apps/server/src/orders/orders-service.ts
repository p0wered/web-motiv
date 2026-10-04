// Заказы (PLAN.md §3.2–3.6): создание со снимком этапов шаблона, видимость, черновик активного
// этапа, «Готово», отмена. Правки сверяются с version — чужие изменения не перезаписываются.
import {
  type AuditEvent,
  type cancelOrderRequestSchema,
  type createOrderRequestSchema,
  missingRequiredFields,
  type Order,
  type OrderFile,
  type OrderSummary,
  type ordersQuerySchema,
  type Permission,
  type saveStageRequestSchema,
  type StageValues,
  stageValueProblem,
  type updateOrderRequestSchema,
  type UserRef,
} from '@webmotiv/shared';
import { and, asc, desc, eq, inArray, like, lt, max, or, type SQL, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { AppDb, Tx } from '../db/db.ts';
import {
  files,
  orders,
  orderStages,
  roles,
  stages,
  templates,
  templateStages,
  users,
} from '../db/schema.ts';
import { queryEvents, recordEvent } from '../events/event-log.ts';
import { HttpError, notFound } from '../http/errors.ts';

type OrderRow = typeof orders.$inferSelect;
type StageRow = typeof orderStages.$inferSelect;

/** Кто смотрит или меняет заказ: права и роли — для видимости и исполнителя этапа. */
export interface Viewer {
  id: number;
  ip: string | null;
  permissions: ReadonlySet<Permission>;
  roleIds: readonly number[];
}

export const VERSION_CONFLICT = 'version_conflict';

const conflict = () =>
  new HttpError(409, 'Заказ уже изменил другой сотрудник — обновите страницу.', {
    code: VERSION_CONFLICT,
  });

/** Не видит заказ — тот же ответ, что «нет такого»: не выдаём, что заказ существует. */
const orderNotFound = () => notFound('Заказ не найден');

const searchTextOf = (number: string, customer: string) =>
  `${number} ${customer}`.toLocaleLowerCase('ru');

export function canViewOrder(viewer: Viewer, order: OrderRow, stageRows: StageRow[]): boolean {
  return (
    viewer.permissions.has('orders.view_all') ||
    order.responsibleId === viewer.id ||
    stageRows.some(
      (stage) =>
        stage.executor === 'role' &&
        stage.executorRoleId !== null &&
        viewer.roleIds.includes(stage.executorRoleId),
    )
  );
}

/** Исполнитель этапа: ответственный по заказу или сотрудник с ролью этапа. */
export function isExecutor(viewer: Viewer, order: OrderRow, stage: StageRow): boolean {
  return stage.executor === 'responsible'
    ? order.responsibleId === viewer.id
    : stage.executorRoleId !== null && viewer.roleIds.includes(stage.executorRoleId);
}

export function canEditStage(viewer: Viewer, order: OrderRow, stage: StageRow): boolean {
  return order.status === 'active' && stage.status === 'active' && isExecutor(viewer, order, stage);
}

/** Почему этап нельзя менять — текст для ответа 403/409. */
export function assertEditable(viewer: Viewer, order: OrderRow, stage: StageRow): void {
  if (order.status !== 'active') {
    throw new HttpError(409, order.status === 'cancelled' ? 'Заказ отменён.' : 'Заказ завершён.');
  }
  if (stage.status === 'done') throw new HttpError(409, 'Этап уже завершён.');
  if (stage.status === 'pending') throw new HttpError(409, 'Этап ещё не начался.');
  if (!isExecutor(viewer, order, stage)) {
    throw new HttpError(403, 'Этот этап заполняет другой сотрудник.');
  }
}

type CreateOrderInput = z.output<typeof createOrderRequestSchema>;
type UpdateOrderInput = z.output<typeof updateOrderRequestSchema>;
type CancelOrderInput = z.output<typeof cancelOrderRequestSchema>;
type SaveStageInput = z.output<typeof saveStageRequestSchema>;
type OrdersQuery = z.output<typeof ordersQuerySchema>;

export class OrdersService {
  private readonly db: AppDb;

  constructor(db: AppDb) {
    this.db = db;
  }

  create(input: CreateOrderInput, viewer: Viewer): Order {
    const id = this.db.transaction((tx) => {
      const template = tx.select().from(templates).where(eq(templates.id, input.templateId)).get();
      if (!template || template.archivedAt !== null) {
        throw new HttpError(422, 'Проверьте поля формы.', {
          fields: { templateId: 'Шаблон не найден или в архиве' },
        });
      }
      const templateStageRows = tx
        .select({ stage: stages })
        .from(templateStages)
        .innerJoin(stages, eq(stages.id, templateStages.stageId))
        .where(eq(templateStages.templateId, template.id))
        .orderBy(asc(templateStages.position))
        .all()
        .map((row) => row.stage);
      if (templateStageRows.length === 0) {
        throw new HttpError(409, 'В шаблоне нет этапов.');
      }

      const now = new Date();
      const number = this.nextNumber(tx, now);
      const order = tx
        .insert(orders)
        .values({
          number,
          customer: input.customer,
          comment: input.comment,
          searchText: searchTextOf(number, input.customer),
          templateId: template.id,
          responsibleId: viewer.id,
          status: 'active',
          version: 0,
          createdBy: viewer.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();
      // Снимок: заказ хранит свою копию этапов — правки шаблона его не коснутся.
      tx.insert(orderStages)
        .values(
          templateStageRows.map((stage, position) => ({
            orderId: order.id,
            position,
            sourceStageId: stage.id,
            name: stage.name,
            description: stage.description,
            executor: stage.executor,
            executorRoleId: stage.executorRoleId,
            fields: stage.fields,
            values: {},
            status: position === 0 ? ('active' as const) : ('pending' as const),
            updatedAt: now,
          })),
        )
        .run();
      recordEvent(tx, {
        actorId: viewer.id,
        action: 'order.created',
        entityType: 'order',
        entityId: order.id,
        orderId: order.id,
        ip: viewer.ip,
        payload: { number, customer: order.customer, template: template.name },
      });
      return order.id;
    });
    return this.get(id, viewer);
  }

  list(query: OrdersQuery, viewer: Viewer): { items: OrderSummary[]; nextBefore: number | null } {
    const conditions: (SQL | undefined)[] = [
      query.view === 'all' ? undefined : eq(orders.status, query.view),
      query.before ? lt(orders.id, query.before) : undefined,
      query.templateId ? eq(orders.templateId, query.templateId) : undefined,
      query.responsibleId ? eq(orders.responsibleId, query.responsibleId) : undefined,
      query.search
        ? sql`${orders.searchText} LIKE ${`%${escapeLike(query.search.toLocaleLowerCase('ru'))}%`} ESCAPE '\\'`
        : undefined,
      this.visibility(viewer),
      query.tasks ? this.waitingFor(viewer) : undefined,
    ];
    const rows = this.db
      .select()
      .from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.id))
      .limit(query.limit + 1)
      .all();
    const page = rows.slice(0, query.limit);
    return {
      items: this.summaries(page, viewer),
      nextBefore: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  /** Сколько заказов ждут вошедшего сотрудника — для счётчика в меню. */
  taskCount(viewer: Viewer): number {
    return (
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(this.waitingFor(viewer))
        .get()?.count ?? 0
    );
  }

  get(id: number, viewer: Viewer): Order {
    const order = this.db.select().from(orders).where(eq(orders.id, id)).get();
    if (!order) throw orderNotFound();
    const stageRows = this.stagesOf(this.db, id);
    if (!canViewOrder(viewer, order, stageRows)) throw orderNotFound();

    const [summary] = this.summaries([order], viewer);
    if (!summary) throw orderNotFound();
    const userRefs = this.userRefs();
    const roleRefs = new Map(
      this.db
        .select({ id: roles.id, name: roles.name })
        .from(roles)
        .all()
        .map((role) => [role.id, role]),
    );
    const fileRows = this.db
      .select()
      .from(files)
      .where(eq(files.orderId, id))
      .orderBy(asc(files.uploadedAt))
      .all();
    const history: AuditEvent[] = queryEvents(this.db, { orderId: id, limit: 200 }).items;

    return {
      ...summary,
      comment: order.comment,
      version: order.version,
      createdBy: refOf(userRefs, order.createdBy),
      completedAt: order.completedAt?.toISOString() ?? null,
      canEditHeader:
        order.status === 'active' &&
        (order.responsibleId === viewer.id || viewer.permissions.has('orders.manage')),
      canManage: order.status === 'active' && viewer.permissions.has('orders.manage'),
      stages: stageRows.map((stage) => ({
        id: stage.id,
        position: stage.position,
        name: stage.name,
        description: stage.description,
        executor: stage.executor,
        executorRole:
          stage.executorRoleId === null ? null : (roleRefs.get(stage.executorRoleId) ?? null),
        fields: stage.fields,
        values: stage.values,
        files: fileRows
          .filter((file) => file.orderStageId === stage.id)
          .map((file): OrderFile => ({
            id: file.id,
            fieldId: file.fieldId,
            name: file.originalName,
            mime: file.mime,
            size: file.size,
            uploadedAt: file.uploadedAt.toISOString(),
            uploadedBy: userRefs.get(file.uploadedBy) ?? null,
          })),
        status: stage.status,
        completedBy: stage.completedBy === null ? null : (userRefs.get(stage.completedBy) ?? null),
        completedAt: stage.completedAt?.toISOString() ?? null,
        canEdit: canEditStage(viewer, order, stage),
      })),
      history,
    };
  }

  /** Шапка заказа: покупатель и комментарий, ответственный. */
  update(id: number, input: UpdateOrderInput, viewer: Viewer): Order {
    this.db.transaction((tx) => {
      const { order } = this.loadForChange(tx, id, viewer, input.version);
      if (order.status !== 'active') throw new HttpError(409, 'Заказ уже не в работе.');
      const manage = viewer.permissions.has('orders.manage');
      const patch: Partial<typeof orders.$inferInsert> = {};
      const changes: Record<string, unknown> = {};

      if (input.customer !== undefined || input.comment !== undefined) {
        if (order.responsibleId !== viewer.id && !manage) {
          throw new HttpError(403, 'Шапку заказа меняет ответственный.');
        }
        if (input.customer !== undefined && input.customer !== order.customer) {
          patch.customer = input.customer;
          patch.searchText = searchTextOf(order.number, input.customer);
          changes.customer = { from: order.customer, to: input.customer };
        }
        if (input.comment !== undefined && input.comment !== order.comment) {
          patch.comment = input.comment;
          changes.comment = true;
        }
      }
      if (input.responsibleId !== undefined && input.responsibleId !== order.responsibleId) {
        if (!manage) throw new HttpError(403, 'Недостаточно прав, чтобы сменить ответственного.');
        const user = tx.select().from(users).where(eq(users.id, input.responsibleId)).get();
        if (!user || !user.isActive) {
          throw new HttpError(422, 'Проверьте поля формы.', {
            fields: { responsibleId: 'Сотрудник не найден или заблокирован' },
          });
        }
        patch.responsibleId = user.id;
        const before = tx.select().from(users).where(eq(users.id, order.responsibleId)).get();
        changes.responsible = { from: before?.fullName ?? '', to: user.fullName };
      }
      if (Object.keys(patch).length === 0) return;

      this.touch(tx, order, patch);
      recordEvent(tx, {
        actorId: viewer.id,
        action: 'order.updated',
        entityType: 'order',
        entityId: id,
        orderId: id,
        ip: viewer.ip,
        payload: { number: order.number, changes },
      });
    });
    return this.get(id, viewer);
  }

  cancel(id: number, input: CancelOrderInput, viewer: Viewer): Order {
    this.db.transaction((tx) => {
      const { order } = this.loadForChange(tx, id, viewer, input.version);
      if (!viewer.permissions.has('orders.manage')) {
        throw new HttpError(403, 'Недостаточно прав, чтобы отменить заказ.');
      }
      if (order.status !== 'active') throw new HttpError(409, 'Заказ уже не в работе.');
      this.touch(tx, order, { status: 'cancelled', completedAt: new Date() });
      recordEvent(tx, {
        actorId: viewer.id,
        action: 'order.cancelled',
        entityType: 'order',
        entityId: id,
        orderId: id,
        ip: viewer.ip,
        payload: { number: order.number, reason: input.reason },
      });
    });
    return this.get(id, viewer);
  }

  /** Черновик активного этапа: значения полей, кроме файлов. Пустые значения убираются. */
  saveStage(id: number, stageId: number, input: SaveStageInput, viewer: Viewer): Order {
    this.db.transaction((tx) => {
      const { order, stage } = this.loadStageForChange(tx, id, stageId, viewer, input.version);
      const fieldsById = new Map(stage.fields.map((field) => [field.id, field]));
      const errors: Record<string, string> = {};
      const values: StageValues = {};

      for (const [fieldId, value] of Object.entries(input.values)) {
        const field = fieldsById.get(fieldId);
        if (!field || field.type === 'file') {
          errors[fieldId] = 'Такого поля в этапе нет';
          continue;
        }
        const problem = stageValueProblem(field, value);
        if (problem) {
          errors[fieldId] = problem;
          continue;
        }
        if (value === null || value === '') continue;
        if (field.type === 'user' && typeof value === 'number') {
          const user = tx.select({ id: users.id }).from(users).where(eq(users.id, value)).get();
          if (!user) {
            errors[fieldId] = 'Сотрудник не найден';
            continue;
          }
        }
        values[fieldId] = typeof value === 'string' ? value.trim() : value;
      }
      if (Object.keys(errors).length > 0) {
        throw new HttpError(422, 'Проверьте выделенные поля.', { fields: errors });
      }

      const changed = stage.fields
        .filter(
          (field) => JSON.stringify(stage.values[field.id]) !== JSON.stringify(values[field.id]),
        )
        .map((field) => field.label);
      if (changed.length === 0) return;

      const now = new Date();
      tx.update(orderStages)
        .set({ values, updatedAt: now })
        .where(eq(orderStages.id, stage.id))
        .run();
      this.touch(tx, order, {});
      recordEvent(tx, {
        actorId: viewer.id,
        action: 'order.stage_saved',
        entityType: 'order_stage',
        entityId: stage.id,
        orderId: id,
        ip: viewer.ip,
        payload: { number: order.number, stage: stage.name, fields: changed },
      });
    });
    return this.get(id, viewer);
  }

  /** «Готово»: обязательные поля заполнены — этап закрыт, следующий открыт (или заказ завершён). */
  completeStage(id: number, stageId: number, version: number, viewer: Viewer): Order {
    this.db.transaction((tx) => {
      const { order, stage } = this.loadStageForChange(tx, id, stageId, viewer, version);
      const fileCounts = new Map<string, number>();
      for (const file of tx.select().from(files).where(eq(files.orderStageId, stage.id)).all()) {
        fileCounts.set(file.fieldId, (fileCounts.get(file.fieldId) ?? 0) + 1);
      }
      const missing = missingRequiredFields(stage.fields, stage.values, fileCounts);
      if (missing.length > 0) {
        throw new HttpError(
          422,
          `Заполните обязательные поля: ${missing.map((field) => `«${field.label}»`).join(', ')}.`,
          { fields: Object.fromEntries(missing.map((field) => [field.id, 'Обязательное поле'])) },
        );
      }

      const now = new Date();
      tx.update(orderStages)
        .set({ status: 'done', completedBy: viewer.id, completedAt: now, updatedAt: now })
        .where(eq(orderStages.id, stage.id))
        .run();
      const next = tx
        .select()
        .from(orderStages)
        .where(and(eq(orderStages.orderId, id), eq(orderStages.position, stage.position + 1)))
        .get();
      if (next) {
        tx.update(orderStages)
          .set({ status: 'active', updatedAt: now })
          .where(eq(orderStages.id, next.id))
          .run();
      }
      this.touch(tx, order, next ? {} : { status: 'completed', completedAt: now });
      recordEvent(tx, {
        actorId: viewer.id,
        action: 'order.stage_completed',
        entityType: 'order_stage',
        entityId: stage.id,
        orderId: id,
        ip: viewer.ip,
        payload: { number: order.number, stage: stage.name, next: next?.name ?? null },
      });
      if (!next) {
        recordEvent(tx, {
          actorId: viewer.id,
          action: 'order.completed',
          entityType: 'order',
          entityId: id,
          orderId: id,
          ip: viewer.ip,
          payload: { number: order.number },
        });
      }
    });
    return this.get(id, viewer);
  }

  /** Заказ и этап для правки этапа: видимость, версия, этап открыт и это его исполнитель. */
  private loadStageForChange(tx: Tx, id: number, stageId: number, viewer: Viewer, version: number) {
    const { order, stageRows } = this.loadForChange(tx, id, viewer, version);
    const stage = stageRows.find((row) => row.id === stageId);
    if (!stage) throw notFound('Этап не найден');
    assertEditable(viewer, order, stage);
    return { order, stage };
  }

  private loadForChange(tx: Tx, id: number, viewer: Viewer, version: number) {
    const order = tx.select().from(orders).where(eq(orders.id, id)).get();
    if (!order) throw orderNotFound();
    const stageRows = this.stagesOf(tx, id);
    if (!canViewOrder(viewer, order, stageRows)) throw orderNotFound();
    if (order.version !== version) throw conflict();
    return { order, stageRows };
  }

  /** Любое изменение заказа увеличивает version. */
  private touch(tx: Tx, order: OrderRow, patch: Partial<typeof orders.$inferInsert>): void {
    tx.update(orders)
      .set({ ...patch, version: order.version + 1, updatedAt: new Date() })
      .where(eq(orders.id, order.id))
      .run();
  }

  private stagesOf(db: AppDb | Tx, orderId: number): StageRow[] {
    return db
      .select()
      .from(orderStages)
      .where(eq(orderStages.orderId, orderId))
      .orderBy(asc(orderStages.position))
      .all();
  }

  /** Номер вида 2026-0001: сквозной в пределах года. */
  private nextNumber(tx: Tx, now: Date): string {
    const prefix = `${now.getFullYear()}-`;
    const last = tx
      .select({ number: max(orders.number) })
      .from(orders)
      .where(like(orders.number, `${prefix}%`))
      .get()?.number;
    const next = last ? Number(last.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(next).padStart(4, '0')}`;
  }

  /** Без права видеть все — только заказы, где сотрудник ответственный или исполнитель этапа. */
  private visibility(viewer: Viewer): SQL | undefined {
    if (viewer.permissions.has('orders.view_all')) return undefined;
    const byRole =
      viewer.roleIds.length > 0
        ? inArray(
            orders.id,
            this.db
              .select({ id: orderStages.orderId })
              .from(orderStages)
              .where(
                and(
                  eq(orderStages.executor, 'role'),
                  inArray(orderStages.executorRoleId, [...viewer.roleIds]),
                ),
              ),
          )
        : undefined;
    return or(eq(orders.responsibleId, viewer.id), byRole);
  }

  /** Заказ в работе, и его активный этап заполняет этот сотрудник. */
  private waitingFor(viewer: Viewer): SQL | undefined {
    const activeStage = this.db
      .select({ id: orderStages.orderId })
      .from(orderStages)
      .innerJoin(orders, eq(orders.id, orderStages.orderId))
      .where(
        and(
          eq(orderStages.status, 'active'),
          or(
            and(eq(orderStages.executor, 'responsible'), eq(orders.responsibleId, viewer.id)),
            viewer.roleIds.length > 0
              ? and(
                  eq(orderStages.executor, 'role'),
                  inArray(orderStages.executorRoleId, [...viewer.roleIds]),
                )
              : undefined,
          ),
        ),
      );
    return and(eq(orders.status, 'active'), inArray(orders.id, activeStage));
  }

  private userRefs(): Map<number, UserRef> {
    return new Map(
      this.db
        .select({ id: users.id, login: users.login, fullName: users.fullName })
        .from(users)
        .all()
        .map((user) => [user.id, user]),
    );
  }

  private summaries(rows: OrderRow[], viewer: Viewer): OrderSummary[] {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const userRefs = this.userRefs();
    const roleRefs = new Map(
      this.db
        .select({ id: roles.id, name: roles.name })
        .from(roles)
        .all()
        .map((role) => [role.id, role]),
    );
    const templateNames = new Map(
      this.db
        .select({ id: templates.id, name: templates.name })
        .from(templates)
        .all()
        .map((template) => [template.id, template.name]),
    );
    const stagesByOrder = new Map<number, StageRow[]>();
    for (const stage of this.db
      .select()
      .from(orderStages)
      .where(inArray(orderStages.orderId, ids))
      .orderBy(asc(orderStages.position))
      .all()) {
      const list = stagesByOrder.get(stage.orderId) ?? [];
      list.push(stage);
      stagesByOrder.set(stage.orderId, list);
    }

    return rows.map((order) => {
      const orderStageRows = stagesByOrder.get(order.id) ?? [];
      const active =
        order.status === 'active'
          ? orderStageRows.find((stage) => stage.status === 'active')
          : undefined;
      return {
        id: order.id,
        number: order.number,
        customer: order.customer,
        status: order.status,
        template: { id: order.templateId, name: templateNames.get(order.templateId) ?? '' },
        responsible: refOf(userRefs, order.responsibleId),
        currentStage: active
          ? {
              name: active.name,
              position: active.position,
              executor: active.executor,
              executorRole:
                active.executorRoleId === null
                  ? null
                  : (roleRefs.get(active.executorRoleId) ?? null),
            }
          : null,
        stageCount: orderStageRows.length,
        doneCount: orderStageRows.filter((stage) => stage.status === 'done').length,
        waitingForMe: active ? isExecutor(viewer, order, active) : false,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      };
    });
  }
}

function refOf(refs: Map<number, UserRef>, id: number): UserRef {
  return refs.get(id) ?? { id, login: '', fullName: 'Удалённый сотрудник' };
}

/** % и _ в поиске — обычные символы, а не шаблон LIKE. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
