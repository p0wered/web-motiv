import { z } from 'zod';
import { PERMISSIONS } from '../domain/permissions.ts';

const permissionsSchema = z
  .array(z.enum(PERMISSIONS))
  .transform((permissions) => [...new Set(permissions)]);

export const roleNameSchema = z.string().trim().min(1, 'Укажите название').max(60);

export const roleSchema = z.object({
  id: z.number(),
  name: z.string(),
  permissions: z.array(z.enum(PERMISSIONS)),
  userCount: z.number(),
  /** В скольких этапах библиотеки роль — исполнитель (такую роль нельзя удалить). */
  stageCount: z.number(),
});

export const rolesResponseSchema = z.array(roleSchema);

export const createRoleRequestSchema = z.strictObject({
  name: roleNameSchema,
  permissions: permissionsSchema,
});

export const updateRoleRequestSchema = z.strictObject({
  name: roleNameSchema.optional(),
  permissions: permissionsSchema.optional(),
});

export type Role = z.infer<typeof roleSchema>;
export type CreateRoleRequest = z.input<typeof createRoleRequestSchema>;
export type UpdateRoleRequest = z.input<typeof updateRoleRequestSchema>;
