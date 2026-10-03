import { z } from 'zod';
import { STAGE_EXECUTORS } from '../domain/orders.ts';
import { roleRefSchema } from './common.ts';

export const TEMPLATE_STAGE_LIMIT = 50;

const nameSchema = z.string().trim().min(1, 'Укажите название').max(120);
const descriptionSchema = z.string().trim().max(1000);

const stageIdsSchema = z
  .array(z.number().int().positive())
  .min(1, 'Добавьте хотя бы один этап')
  .max(TEMPLATE_STAGE_LIMIT, `Не больше ${TEMPLATE_STAGE_LIMIT} этапов`)
  .refine((ids) => new Set(ids).size === ids.length, 'Этап встречается в шаблоне дважды');

export const createTemplateRequestSchema = z.strictObject({
  name: nameSchema,
  description: descriptionSchema.default(''),
  stageIds: stageIdsSchema,
});

export const updateTemplateRequestSchema = z.strictObject({
  name: nameSchema.optional(),
  description: descriptionSchema.optional(),
  stageIds: stageIdsSchema.optional(),
  archived: z.boolean().optional(),
});

/** Этап в шаблоне — кратко: для списка последовательности. */
export const templateStageSchema = z.object({
  id: z.number(),
  name: z.string(),
  executor: z.enum(STAGE_EXECUTORS),
  executorRole: roleRefSchema.nullable(),
  fieldCount: z.number(),
  archived: z.boolean(),
});

export const templateSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  stages: z.array(templateStageSchema),
  archived: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  /** Заказов по шаблону — такой шаблон нельзя удалить, только архивировать. */
  orderCount: z.number(),
});

export const templatesResponseSchema = z.array(templateSchema);

export type TemplateStage = z.infer<typeof templateStageSchema>;
export type Template = z.infer<typeof templateSchema>;
export type CreateTemplateRequest = z.input<typeof createTemplateRequestSchema>;
export type UpdateTemplateRequest = z.input<typeof updateTemplateRequestSchema>;
