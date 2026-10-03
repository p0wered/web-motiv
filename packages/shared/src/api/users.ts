import { z } from 'zod';
import { roleRefSchema, sessionInfoSchema } from './common.ts';

/** Логин: латиница, цифры, точка, дефис, подчёркивание — его вводят на любой раскладке. */
export const loginSchema = z
  .string()
  .trim()
  .min(3, 'Не короче 3 символов')
  .max(32, 'Не длиннее 32 символов')
  .regex(/^[a-zA-Z0-9._-]+$/, 'Только латиница, цифры, точка, дефис и подчёркивание');

export const fullNameSchema = z.string().trim().min(1, 'Укажите ФИО').max(120);

const roleIdsSchema = z
  .array(z.number().int().positive())
  .max(50)
  .transform((ids) => [...new Set(ids)]);

export const userSchema = z.object({
  id: z.number(),
  login: z.string(),
  fullName: z.string(),
  isActive: z.boolean(),
  mustChangePassword: z.boolean(),
  roles: z.array(roleRefSchema),
  createdAt: z.iso.datetime(),
  lastLoginAt: z.iso.datetime().nullable(),
  activeSessions: z.number(),
});

export const usersResponseSchema = z.array(userSchema);

export const userDetailSchema = userSchema.extend({
  sessions: z.array(sessionInfoSchema),
});

export const createUserRequestSchema = z.strictObject({
  login: loginSchema,
  fullName: fullNameSchema,
  roleIds: roleIdsSchema,
});

/** Временный пароль показывается администратору один раз — сотрудник сменит его при входе. */
export const createUserResponseSchema = z.object({
  user: userSchema,
  temporaryPassword: z.string(),
});

export const updateUserRequestSchema = z.strictObject({
  login: loginSchema.optional(),
  fullName: fullNameSchema.optional(),
  roleIds: roleIdsSchema.optional(),
  isActive: z.boolean().optional(),
});

export const resetPasswordResponseSchema = z.object({ temporaryPassword: z.string() });

export type User = z.infer<typeof userSchema>;
export type UserDetail = z.infer<typeof userDetailSchema>;
export type CreateUserRequest = z.input<typeof createUserRequestSchema>;
export type UpdateUserRequest = z.input<typeof updateUserRequestSchema>;
