// Значения полей этапа в заказе: проверка типа (при сохранении черновика) и «заполнено ли»
// (перед «Готово»). Одни правила для сервера и формы.
import type { StageField, StageFieldValue, StageValues } from './stage-fields.ts';

export const TEXT_LIMIT = 500;
export const TEXTAREA_LIMIT = 10_000;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Что не так со значением поля; `null` — подходит (пустое тоже подходит — это черновик). */
export function stageValueProblem(field: StageField, value: StageFieldValue): string | null {
  if (value === null || value === '') return null;
  switch (field.type) {
    case 'text':
    case 'textarea': {
      if (typeof value !== 'string') return 'Ожидается текст';
      const limit = field.type === 'text' ? TEXT_LIMIT : TEXTAREA_LIMIT;
      return value.length > limit ? `Не длиннее ${limit} символов` : null;
    }
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? null : 'Ожидается число';
    case 'date':
      return typeof value === 'string' && validDate(value) ? null : 'Ожидается дата';
    case 'select':
      return typeof value === 'string' && field.options.some((option) => option.id === value)
        ? null
        : 'Такого варианта нет';
    case 'checkbox':
      return typeof value === 'boolean' ? null : 'Ожидается да или нет';
    case 'user':
      return typeof value === 'number' && Number.isInteger(value) && value > 0
        ? null
        : 'Выберите сотрудника';
    case 'file':
      return 'Файлы прикрепляются отдельно';
  }
}

/** Заполнено ли поле: у флажка — отмечен, у файлов — есть хотя бы один. */
export function isFieldFilled(field: StageField, values: StageValues, fileCount: number): boolean {
  if (field.type === 'file') return fileCount > 0;
  const value = values[field.id];
  if (field.type === 'checkbox') return value === true;
  if (typeof value === 'string') return value.trim() !== '';
  return value !== null && value !== undefined;
}

/** Обязательные поля, которые ещё не заполнены. */
export function missingRequiredFields(
  fields: readonly StageField[],
  values: StageValues,
  fileCounts: ReadonlyMap<string, number>,
): StageField[] {
  return fields.filter(
    (field) => field.required && !isFieldFilled(field, values, fileCounts.get(field.id) ?? 0),
  );
}
