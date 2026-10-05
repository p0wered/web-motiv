// Журнал событий (PLAN.md §7.5): только добавление, API на изменение и удаление нет.
import type { AuditEvent, EventAction, EventGroup } from '@webmotiv/shared';
import { and, count, desc, eq, like } from 'drizzle-orm';
import type { AppDb, Tx } from '../db/db.ts';
import { events, users } from '../db/schema.ts';

export interface EventInput {
  actorId: number | null;
  action: EventAction;
  entityType: string;
  entityId?: string | number | null;
  orderId?: number | null;
  ip?: string | null;
  payload?: Record<string, unknown> | null;
}

/** Записывает событие в той же транзакции, что и само изменение. */
export function recordEvent(tx: Tx | AppDb, input: EventInput, now = new Date()): void {
  tx.insert(events)
    .values({
      at: now,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId == null ? null : String(input.entityId),
      orderId: input.orderId ?? null,
      ip: input.ip ?? null,
      payload: input.payload ?? null,
    })
    .run();
}

export interface EventFilter {
  /** Номер страницы, с 1. */
  page?: number | undefined;
  limit: number;
  group?: EventGroup | undefined;
  actorId?: number | undefined;
  /** История одного заказа. */
  orderId?: number | undefined;
}

/** Страница событий от новых к старым и сколько их всего по фильтру. */
export function queryEvents(
  db: AppDb,
  filter: EventFilter,
): { items: AuditEvent[]; total: number } {
  const where = and(
    filter.group ? like(events.action, `${filter.group}.%`) : undefined,
    filter.actorId ? eq(events.actorId, filter.actorId) : undefined,
    filter.orderId ? eq(events.orderId, filter.orderId) : undefined,
  );
  const total = db.select({ count: count() }).from(events).where(where).get()?.count ?? 0;
  const rows = db
    .select({
      event: events,
      actor: { id: users.id, login: users.login, fullName: users.fullName },
    })
    .from(events)
    .leftJoin(users, eq(users.id, events.actorId))
    .where(where)
    .orderBy(desc(events.id))
    .limit(filter.limit)
    .offset(((filter.page ?? 1) - 1) * filter.limit)
    .all();

  return {
    items: rows.map(({ event, actor }) => ({
      id: event.id,
      at: event.at.toISOString(),
      actor: actor?.id ? actor : null,
      action: event.action as EventAction,
      entityType: event.entityType,
      entityId: event.entityId,
      ip: event.ip,
      payload: event.payload,
    })),
    total,
  };
}
