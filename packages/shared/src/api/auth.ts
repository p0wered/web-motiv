import { z } from 'zod';
import { PASSWORD_MAX_LENGTH } from '../domain/password-policy.ts';
import { PERMISSIONS } from '../domain/permissions.ts';
import { roleRefSchema, sessionInfoSchema } from './common.ts';

export const loginRequestSchema = z.strictObject({
  login: z.string().trim().min(1, 'Введите логин').max(100),
  password: z.string().min(1, 'Введите пароль').max(PASSWORD_MAX_LENGTH),
});

/** Текущий сотрудник: кто вошёл и что ему можно. */
export const meResponseSchema = z.object({
  id: z.number(),
  login: z.string(),
  fullName: z.string(),
  mustChangePassword: z.boolean(),
  permissions: z.array(z.enum(PERMISSIONS)),
  roles: z.array(roleRefSchema),
});

/**
 * Смена своего пароля. Текущий пароль не нужен только сразу после входа с временным —
 * сотрудник только что его ввёл.
 */
export const changePasswordRequestSchema = z
  .strictObject({
    current: z.string().max(PASSWORD_MAX_LENGTH).optional(),
    password: z.string().max(PASSWORD_MAX_LENGTH),
    confirmation: z.string().max(PASSWORD_MAX_LENGTH),
  })
  .refine((value) => value.password === value.confirmation, {
    path: ['confirmation'],
    message: 'Пароли не совпадают',
  });

export const sessionsResponseSchema = z.array(sessionInfoSchema);

export const sessionParamsSchema = z.strictObject({ id: z.string().regex(/^[0-9a-f]{64}$/) });

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
