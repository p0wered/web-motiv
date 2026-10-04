import { describe, expect, it } from 'vitest';
import type { StageField } from './stage-fields.ts';
import { isFieldFilled, missingRequiredFields, stageValueProblem } from './stage-values.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const field = (type: StageField['type'], extra: object = {}): StageField =>
  ({ id: id(1), label: 'Поле', required: true, hint: '', type, ...extra }) as StageField;

describe('stageValueProblem', () => {
  it('проверяет тип значения', () => {
    expect(stageValueProblem(field('number'), '12')).toBe('Ожидается число');
    expect(stageValueProblem(field('number'), 12.5)).toBeNull();
    expect(stageValueProblem(field('date'), '2026-02-30')).toBe('Ожидается дата');
    expect(stageValueProblem(field('date'), '2026-10-04')).toBeNull();
    expect(stageValueProblem(field('checkbox'), 'да')).not.toBeNull();
    expect(stageValueProblem(field('text'), 'x'.repeat(501))).toMatch(/500/);
    const select = field('select', { options: [{ id: id(2), label: 'Безнал' }] });
    expect(stageValueProblem(select, id(2))).toBeNull();
    expect(stageValueProblem(select, id(3))).toBe('Такого варианта нет');
    expect(stageValueProblem(field('file'), ['x'])).not.toBeNull();
  });

  it('пустое значение — не ошибка: это черновик', () => {
    expect(stageValueProblem(field('number'), null)).toBeNull();
    expect(stageValueProblem(field('text'), '')).toBeNull();
  });
});

describe('обязательные поля', () => {
  it('флажок — только отмеченный, текст — не из пробелов, файлы — хотя бы один', () => {
    expect(isFieldFilled(field('checkbox'), { [id(1)]: false }, 0)).toBe(false);
    expect(isFieldFilled(field('checkbox'), { [id(1)]: true }, 0)).toBe(true);
    expect(isFieldFilled(field('text'), { [id(1)]: '  ' }, 0)).toBe(false);
    expect(isFieldFilled(field('number'), { [id(1)]: 0 }, 0)).toBe(true);
    expect(isFieldFilled(field('file'), {}, 1)).toBe(true);
    const fields = [field('text'), { ...field('file'), id: id(2) }];
    expect(missingRequiredFields(fields, { [id(1)]: 'есть' }, new Map()).map((f) => f.id)).toEqual([
      id(2),
    ]);
  });
});
