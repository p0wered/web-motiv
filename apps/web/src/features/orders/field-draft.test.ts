import type { StageField } from '@webmotiv/shared';
import { describe, expect, it } from 'vitest';
import { draftChanged, fromDraft, toDraft } from './field-draft.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const fields = [
  { id: id(1), type: 'number', label: 'Сумма', required: false, hint: '' },
  { id: id(2), type: 'checkbox', label: 'Пришло', required: false, hint: '' },
  { id: id(3), type: 'text', label: 'Номер', required: false, hint: '' },
  { id: id(4), type: 'user', label: 'Кто', required: false, hint: '' },
] as StageField[];

describe('черновик этапа', () => {
  it('число с запятой и пробелами, пустые значения не отправляются', () => {
    const draft = { ...toDraft(fields, {}), [id(1)]: '12 500,5', [id(4)]: '7' };
    expect(fromDraft(fields, draft)).toEqual({
      values: { [id(1)]: 12500.5, [id(4)]: 7 },
      errors: {},
    });
    expect(fromDraft(fields, { ...draft, [id(1)]: '12а' }).errors[id(1)]).toBe('Введите число');
  });

  it('изменения — по значениям: «12,0» то же, что 12', () => {
    const saved = { [id(1)]: 12, [id(3)]: 'СЧ-1' };
    const draft = toDraft(fields, saved);
    expect(draftChanged(fields, { ...draft, [id(1)]: '12,0' }, saved)).toBe(false);
    expect(draftChanged(fields, { ...draft, [id(3)]: 'СЧ-1 ' }, saved)).toBe(false);
    expect(draftChanged(fields, { ...draft, [id(2)]: true }, saved)).toBe(true);
  });
});

describe('показ числа', () => {
  it('дробная часть — через запятую', () => {
    expect(toDraft(fields, { [id(1)]: 12500.5 })[id(1)]).toBe('12500,5');
  });
});
