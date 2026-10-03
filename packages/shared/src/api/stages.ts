import { z } from 'zod';
import { STAGE_EXECUTORS } from '../domain/orders.ts';
import { stageFieldsSchema } from '../domain/stage-fields.ts';
import { roleRefSchema } from './common.ts';

export const stageNameSchema = z.string().trim().min(1, 'Укажите название').max(120);
const descriptionSchema = z.string().trim().max(1000);

/** Исполнитель: роль — с id роли, ответственный по заказу — без. */
const executorShape = {
  executor: z.enum(STAGE_EXECUTORS),
  executorRoleId: z.number().int().positive().nullable(),
};

export const createStageRequestSchema = z
  .strictObject({
    name: stageNameSchema,
    description: descriptionSchema.default(''),
    ...executorShape,
    fields: stageFieldsSchema,
  })
  .refine((stage) => (stage.executor === 'role') === (stage.executorRoleId !== null), {
    path: ['executorRoleId'],
    message: 'Выберите роль',
  });

/** Правка: любые поля по отдельности; исполнитель — только вместе с ролью. */
export const updateStageRequestSchema = z
  .strictObject({
    name: stageNameSchema.optional(),
    description: descriptionSchema.optional(),
    executor: executorShape.executor.optional(),
    executorRoleId: executorShape.executorRoleId.optional(),
    fields: stageFieldsSchema.optional(),
    archived: z.boolean().optional(),
  })
  .refine((stage) => (stage.executor === undefined) === (stage.executorRoleId === undefined), {
    path: ['executorRoleId'],
    message: 'Исполнитель меняется вместе с ролью',
  })
  .refine(
    (stage) =>
      stage.executor === undefined ||
      (stage.executor === 'role') === (stage.executorRoleId !== null),
    { path: ['executorRoleId'], message: 'Выберите роль' },
  );

export const templateRefSchema = z.object({
  id: z.number(),
  name: z.string(),
  archived: z.boolean(),
});

export const stageSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  executor: z.enum(STAGE_EXECUTORS),
  executorRole: roleRefSchema.nullable(),
  fields: stageFieldsSchema,
  archived: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  /** Шаблоны, в которые входит этап. */
  templates: z.array(templateRefSchema),
  /** Сколько заказов уже взяли этот этап в свой снимок — такой этап нельзя удалить. */
  orderCount: z.number(),
});

export const stagesResponseSchema = z.array(stageSchema);

export type Stage = z.infer<typeof stageSchema>;
export type CreateStageRequest = z.input<typeof createStageRequestSchema>;
export type UpdateStageRequest = z.input<typeof updateStageRequestSchema>;
