import {
  STAGE_FIELD_TYPE_LABELS,
  STAGE_FIELD_TYPES,
  type StageField,
  type StageFieldType,
  stageFieldsProblems,
} from '@webmotiv/shared';
import {
  AlignLeft,
  Calendar,
  Hash,
  type LucideIcon,
  Paperclip,
  SquareCheck,
  SquareChevronDown,
  Type,
  UserRound,
} from 'lucide-react';
import { newId } from '../../lib/id.ts';

export const FIELD_TYPE_ICONS: Record<StageFieldType, LucideIcon> = {
  text: Type,
  textarea: AlignLeft,
  number: Hash,
  date: Calendar,
  select: SquareChevronDown,
  checkbox: SquareCheck,
  user: UserRound,
  file: Paperclip,
};

const FIELD_TYPE_DESCRIPTIONS: Record<StageFieldType, string> = {
  text: 'Номер счёта, трек-номер',
  textarea: 'Перечень позиций, комментарий',
  number: 'Сумма, количество',
  date: 'Выбор в календаре',
  select: 'Один из заданных вариантов',
  checkbox: 'Да или нет',
  user: 'Кто-то из сотрудников',
  file: 'Счёт, УПД, фото',
};

export const FIELD_TYPE_OPTIONS = STAGE_FIELD_TYPES.map((type) => ({
  value: type,
  label: STAGE_FIELD_TYPE_LABELS[type],
  description: FIELD_TYPE_DESCRIPTIONS[type],
  icon: FIELD_TYPE_ICONS[type],
}));

/** Новое поле: название вводится сразу после добавления. */
export function createField(type: StageFieldType): StageField {
  return withType({ id: newId(), type: 'text', label: '', required: false, hint: '' }, type);
}

/** Смена типа: название, обязательность и подсказка остаются, особые настройки — по типу. */
export function withType(field: StageField, type: StageFieldType): StageField {
  const base = { id: field.id, label: field.label, required: field.required, hint: field.hint };
  switch (type) {
    case 'select':
      return {
        ...base,
        type,
        options: field.type === 'select' ? field.options : [{ id: newId(), label: '' }],
      };
    case 'file':
      return { ...base, type, multiple: field.type === 'file' ? field.multiple : false };
    default:
      return { ...base, type };
  }
}

/** Ошибки полей до отправки: номер поля → текст. Те же правила, что на сервере. */
export function fieldProblems(fields: readonly StageField[]): Map<number, string> {
  const problems = new Map<number, string>();
  fields.forEach((field, index) => {
    if (!field.label.trim()) problems.set(index, 'Укажите название поля');
    else if (field.type === 'select' && field.options.some((option) => !option.label.trim())) {
      problems.set(index, 'Заполните все варианты или удалите пустые');
    }
  });
  for (const problem of stageFieldsProblems(fields)) {
    if (!problems.has(problem.index)) problems.set(problem.index, problem.message);
  }
  return problems;
}
