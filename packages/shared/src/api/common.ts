import { z } from 'zod';

/** Числовой id из адреса (`/users/:id`). */
export const idParamsSchema = z.strictObject({ id: z.coerce.number().int().positive() });

/** Краткая ссылка на роль или сотрудника в ответах. */
export const roleRefSchema = z.object({ id: z.number(), name: z.string() });
export const userRefSchema = z.object({ id: z.number(), login: z.string(), fullName: z.string() });

export type RoleRef = z.infer<typeof roleRefSchema>;
export type UserRef = z.infer<typeof userRefSchema>;

/** Сеанс входа: где и когда сотрудник вошёл. */
export const sessionInfoSchema = z.object({
  id: z.string(),
  /** Сеанс, из которого сделан запрос. */
  current: z.boolean(),
  createdAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
});

export type SessionInfo = z.infer<typeof sessionInfoSchema>;
