// Схема полей этапа — общая для сервера (проверка значений) и конструктора этапов.
import { z } from 'zod';

export const STAGE_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'date',
  'select',
  'checkbox',
  'user',
  'file',
] as const;

export const STAGE_FIELD_LIMIT = 50;
export const SELECT_OPTION_LIMIT = 50;

const fieldBase = {
  /** Стабильный id: переименование поля не теряет значения в заказах. */
  id: z.uuid(),
  label: z.string().trim().min(1, 'Укажите название поля').max(120),
  required: z.boolean(),
  hint: z.string().trim().max(300).default(''),
};

export const selectOptionSchema = z.strictObject({
  id: z.uuid(),
  label: z.string().trim().min(1, 'Укажите вариант').max(120),
});

export const stageFieldSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...fieldBase, type: z.literal('text') }),
  z.strictObject({ ...fieldBase, type: z.literal('textarea') }),
  z.strictObject({ ...fieldBase, type: z.literal('number') }),
  z.strictObject({ ...fieldBase, type: z.literal('date') }),
  z.strictObject({
    ...fieldBase,
    type: z.literal('select'),
    options: z
      .array(selectOptionSchema)
      .min(1, 'Добавьте хотя бы один вариант')
      .max(SELECT_OPTION_LIMIT),
  }),
  z.strictObject({ ...fieldBase, type: z.literal('checkbox') }),
  z.strictObject({ ...fieldBase, type: z.literal('user') }),
  z.strictObject({ ...fieldBase, type: z.literal('file'), multiple: z.boolean() }),
]);

export type StageField = z.output<typeof stageFieldSchema>;
export type StageFieldType = StageField['type'];
export type SelectOption = z.output<typeof selectOptionSchema>;

export const STAGE_FIELD_TYPE_LABELS: Record<StageFieldType, string> = {
  text: 'Строка',
  textarea: 'Текст',
  number: 'Число',
  date: 'Дата',
  select: 'Выбор из списка',
  checkbox: 'Флажок',
  user: 'Сотрудник',
  file: 'Файлы',
};

/** Что не так с набором полей (одинаковые названия и т. п.): номер поля и текст; пусто — всё хорошо. */
export function stageFieldsProblems(
  fields: readonly StageField[],
): { index: number; message: string }[] {
  const problems: { index: number; message: string }[] = [];
  const labels = new Map<string, number>();
  const ids = new Set<string>();
  fields.forEach((field, index) => {
    const label = field.label.trim().toLocaleLowerCase('ru');
    if (label && labels.has(label)) {
      problems.push({ index, message: `Поле «${field.label.trim()}» уже есть в этапе` });
    } else labels.set(label, index);
    if (ids.has(field.id)) problems.push({ index, message: 'Повторяется id поля' });
    ids.add(field.id);
    if (field.type === 'select') {
      const options = new Set<string>();
      for (const option of field.options) {
        const optionLabel = option.label.trim().toLocaleLowerCase('ru');
        if (optionLabel && options.has(optionLabel)) {
          problems.push({ index, message: `Вариант «${option.label.trim()}» повторяется` });
          break;
        }
        options.add(optionLabel);
      }
    }
  });
  return problems;
}

export const stageFieldsSchema = z
  .array(stageFieldSchema)
  .max(STAGE_FIELD_LIMIT, `Не больше ${STAGE_FIELD_LIMIT} полей`)
  .superRefine((fields, context) => {
    for (const problem of stageFieldsProblems(fields)) {
      context.addIssue({ code: 'custom', message: problem.message, path: [problem.index] });
    }
  });

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
