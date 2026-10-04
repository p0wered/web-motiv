import { z } from 'zod';
import { ORDER_STAGE_STATUSES, ORDER_STATUSES, STAGE_EXECUTORS } from '../domain/orders.ts';
import { stageFieldsSchema, stageFieldValueSchema } from '../domain/stage-fields.ts';
import { roleRefSchema, userRefSchema } from './common.ts';
import { eventSchema } from './events.ts';

export const customerSchema = z.string().trim().min(1, 'Укажите покупателя').max(200);
const commentSchema = z.string().trim().max(2000);
/** Версия заказа, которую видел клиент: если заказ успели изменить, правка отклоняется. */
const versionSchema = z.number().int().nonnegative();

export const createOrderRequestSchema = z.strictObject({
  templateId: z.number().int().positive({ message: 'Выберите шаблон' }),
  customer: customerSchema,
  comment: commentSchema.default(''),
});

/** Шапка заказа: покупатель и комментарий — ответственному, ответственный — по праву. */
export const updateOrderRequestSchema = z.strictObject({
  version: versionSchema,
  customer: customerSchema.optional(),
  comment: commentSchema.optional(),
  responsibleId: z.number().int().positive().optional(),
});

export const cancelOrderRequestSchema = z.strictObject({
  version: versionSchema,
  reason: z.string().trim().max(500).default(''),
});

/** Черновик этапа: значения полей, кроме файлов (файлы прикрепляются отдельно). */
export const saveStageRequestSchema = z.strictObject({
  version: versionSchema,
  values: z.record(z.string(), stageFieldValueSchema),
});

export const completeStageRequestSchema = z.strictObject({ version: versionSchema });

export const orderStageParamsSchema = z.strictObject({
  id: z.coerce.number().int().positive(),
  stageId: z.coerce.number().int().positive(),
});

export const ORDER_LIST_VIEWS = ['active', 'completed', 'cancelled', 'all'] as const;
export type OrderListView = (typeof ORDER_LIST_VIEWS)[number];

export const ordersQuerySchema = z.strictObject({
  view: z.enum(ORDER_LIST_VIEWS).default('active'),
  /** Только заказы, где сейчас этап вошедшего сотрудника. */
  tasks: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default(false),
  search: z.string().trim().max(100).optional(),
  templateId: z.coerce.number().int().positive().optional(),
  responsibleId: z.coerce.number().int().positive().optional(),
  /** Курсор: заказы с id меньше этого. */
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const orderFileSchema = z.object({
  id: z.string(),
  fieldId: z.string(),
  name: z.string(),
  mime: z.string(),
  size: z.number(),
  uploadedAt: z.iso.datetime(),
  uploadedBy: userRefSchema.nullable(),
});

export const orderStageSchema = z.object({
  id: z.number(),
  position: z.number(),
  name: z.string(),
  description: z.string(),
  executor: z.enum(STAGE_EXECUTORS),
  executorRole: roleRefSchema.nullable(),
  fields: stageFieldsSchema,
  values: z.record(z.string(), stageFieldValueSchema),
  files: z.array(orderFileSchema),
  status: z.enum(ORDER_STAGE_STATUSES),
  completedBy: userRefSchema.nullable(),
  completedAt: z.iso.datetime().nullable(),
  /** Вошедший сотрудник — исполнитель этого этапа и этап сейчас открыт. */
  canEdit: z.boolean(),
});

/** Строка списка заказов. */
export const orderSummarySchema = z.object({
  id: z.number(),
  number: z.string(),
  customer: z.string(),
  status: z.enum(ORDER_STATUSES),
  template: z.object({ id: z.number(), name: z.string() }),
  responsible: userRefSchema,
  /** Активный этап; у завершённого и отменённого — нет. */
  currentStage: z
    .object({
      name: z.string(),
      position: z.number(),
      executor: z.enum(STAGE_EXECUTORS),
      executorRole: roleRefSchema.nullable(),
    })
    .nullable(),
  stageCount: z.number(),
  doneCount: z.number(),
  waitingForMe: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const ordersResponseSchema = z.object({
  items: z.array(orderSummarySchema),
  nextBefore: z.number().nullable(),
});

export const orderSchema = orderSummarySchema.extend({
  comment: z.string(),
  version: z.number(),
  createdBy: userRefSchema,
  completedAt: z.iso.datetime().nullable(),
  stages: z.array(orderStageSchema),
  history: z.array(eventSchema),
  /** Может менять покупателя и комментарий (ответственный или с правом). */
  canEditHeader: z.boolean(),
  /** Может отменить заказ и сменить ответственного. */
  canManage: z.boolean(),
});

/** Сотрудники для выбора (поле «Сотрудник», ответственный). */
export const directoryUserSchema = z.object({
  id: z.number(),
  fullName: z.string(),
  isActive: z.boolean(),
});
export const directoryResponseSchema = z.array(directoryUserSchema);

export const myTasksCountSchema = z.object({ count: z.number() });

export type OrderListQuery = z.input<typeof ordersQuerySchema>;
export type OrderSummary = z.infer<typeof orderSummarySchema>;
export type Order = z.infer<typeof orderSchema>;
export type OrderStage = z.infer<typeof orderStageSchema>;
export type OrderFile = z.infer<typeof orderFileSchema>;
export type DirectoryUser = z.infer<typeof directoryUserSchema>;
export type CreateOrderRequest = z.input<typeof createOrderRequestSchema>;
export type UpdateOrderRequest = z.input<typeof updateOrderRequestSchema>;
