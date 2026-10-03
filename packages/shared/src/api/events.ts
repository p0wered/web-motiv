import { z } from 'zod';
import { userRefSchema } from './common.ts';

/** Действия в журнале. Новые добавляются в конец; старые не переименовываются. */
export const EVENT_ACTIONS = [
  'auth.login_succeeded',
  'auth.login_failed',
  'auth.logout',
  'auth.password_changed',
  'auth.sessions_terminated',
  'user.created',
  'user.updated',
  'user.password_reset',
  'user.sessions_terminated',
  'role.created',
  'role.updated',
  'role.deleted',
] as const;

export type EventAction = (typeof EVENT_ACTIONS)[number];

/** Группы для фильтра журнала: по первой части действия. */
export const EVENT_GROUPS = ['auth', 'user', 'role'] as const;
export type EventGroup = (typeof EVENT_GROUPS)[number];

export const eventSchema = z.object({
  id: z.number(),
  at: z.iso.datetime(),
  actor: userRefSchema.nullable(),
  action: z.enum(EVENT_ACTIONS),
  entityType: z.string(),
  entityId: z.string().nullable(),
  ip: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()).nullable(),
});

export const eventsQuerySchema = z.strictObject({
  /** Курсор: события с id меньше этого (следующая порция). */
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  group: z.enum(EVENT_GROUPS).optional(),
  actorId: z.coerce.number().int().positive().optional(),
});

export const eventsResponseSchema = z.object({
  items: z.array(eventSchema),
  nextBefore: z.number().nullable(),
});

export type AuditEvent = z.infer<typeof eventSchema>;
export type EventsQuery = z.input<typeof eventsQuerySchema>;
