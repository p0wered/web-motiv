// Черновик полей этапа в форме: числа редактируются строкой («12,5»), в значение превращаются
// при сохранении. Файлы в черновик не входят — они прикрепляются сразу.
import type { StageField, StageFieldValue, StageValues } from '@webmotiv/shared';

export type DraftValue = string | boolean;
export type Draft = Record<string, DraftValue>;

export function toDraft(fields: readonly StageField[], values: StageValues): Draft {
  const draft: Draft = {};
  for (const field of fields) {
    const value = values[field.id];
    if (field.type === 'file') continue;
    if (field.type === 'checkbox') draft[field.id] = value === true;
    else if (value === null || value === undefined) draft[field.id] = '';
    // Дробная часть — через запятую, как привычно; при сохранении запятая снова станет точкой.
    else
      draft[field.id] = typeof value === 'number' ? String(value).replace('.', ',') : String(value);
  }
  return draft;
}

/** Значения для сервера; число, которое не разобрать, — ошибка у поля. */
export function fromDraft(
  fields: readonly StageField[],
  draft: Draft,
): { values: StageValues; errors: Record<string, string> } {
  const values: StageValues = {};
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (field.type === 'file') continue;
    const raw = draft[field.id];
    let value: StageFieldValue = null;
    if (field.type === 'checkbox') value = raw === true;
    else if (typeof raw === 'string' && raw.trim() !== '') {
      if (field.type === 'number') {
        const parsed = Number(raw.replace(/\s/g, '').replace(',', '.'));
        if (Number.isFinite(parsed)) value = parsed;
        else errors[field.id] = 'Введите число';
      } else if (field.type === 'user') value = Number(raw);
      else value = raw;
    }
    if (value !== null && value !== false) values[field.id] = value;
  }
  return { values, errors };
}

/** Есть ли несохранённые правки: сравниваются значения, а не строки ввода. */
export function draftChanged(
  fields: readonly StageField[],
  draft: Draft,
  saved: StageValues,
): boolean {
  const { values } = fromDraft(fields, draft);
  return fields.some((field) => {
    if (field.type === 'file') return false;
    const before = saved[field.id];
    const after = values[field.id];
    const norm = (value: StageFieldValue | undefined) =>
      value === undefined || value === null || value === false
        ? null
        : typeof value === 'string'
          ? value.trim()
          : value;
    return JSON.stringify(norm(before)) !== JSON.stringify(norm(after));
  });
}
