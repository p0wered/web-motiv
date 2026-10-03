// Схема полей этапа — общая для сервера (проверка значений) и конструктора этапов.
import { z } from 'zod';

const fieldBase = {
  /** Стабильный id: переименование поля не теряет значения в заказах. */
  id: z.uuid(),
  label: z.string().trim().min(1, 'Укажите название поля').max(120),
  required: z.boolean(),
  hint: z.string().trim().max(300).optional(),
};

export const stageFieldSchema = z.discriminatedUnion('type', [
  z.object({ ...fieldBase, type: z.literal('text') }),
  z.object({ ...fieldBase, type: z.literal('textarea') }),
  z.object({ ...fieldBase, type: z.literal('number') }),
  z.object({ ...fieldBase, type: z.literal('date') }),
  z.object({
    ...fieldBase,
    type: z.literal('select'),
    options: z
      .array(z.object({ id: z.uuid(), label: z.string().trim().min(1).max(120) }))
      .min(1, 'Добавьте хотя бы один вариант')
      .max(50),
  }),
  z.object({ ...fieldBase, type: z.literal('checkbox') }),
  z.object({ ...fieldBase, type: z.literal('user') }),
  z.object({ ...fieldBase, type: z.literal('file'), multiple: z.boolean() }),
]);

export type StageField = z.infer<typeof stageFieldSchema>;
export type StageFieldType = StageField['type'];

export const stageFieldsSchema = z.array(stageFieldSchema).max(50);

/** Значение поля в заказе: текст, число, дата (YYYY-MM-DD), флажок, id сотрудника, id файлов. */
export const stageFieldValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null(),
]);

export type StageFieldValue = z.infer<typeof stageFieldValueSchema>;
export type StageValues = Record<string, StageFieldValue>;
