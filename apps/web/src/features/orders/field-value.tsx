import type { DirectoryUser, StageField, StageFieldValue } from '@webmotiv/shared';
import { Check, Minus } from 'lucide-react';
import { formatDate, formatNumber } from '../../lib/format.ts';

/** Значение поля для чтения: завершённый этап, чужой этап, отменённый заказ. */
export function FieldValueText({
  field,
  value,
  users,
}: {
  field: StageField;
  value: StageFieldValue | undefined;
  users: DirectoryUser[];
}) {
  const empty = <span className="text-subtle">—</span>;
  if (value === undefined || value === null || value === '') {
    return field.type === 'checkbox' ? <No /> : empty;
  }
  switch (field.type) {
    case 'checkbox':
      return value === true ? <Yes /> : <No />;
    case 'number':
      return (
        <span className="tabular">
          {typeof value === 'number' ? formatNumber(value) : String(value)}
        </span>
      );
    case 'date':
      return <span>{typeof value === 'string' ? formatDate(value) : String(value)}</span>;
    case 'select':
      return <span>{field.options.find((option) => option.id === value)?.label ?? empty}</span>;
    case 'user':
      return <span>{users.find((user) => user.id === value)?.fullName ?? 'Сотрудник удалён'}</span>;
    case 'textarea':
      return <span className="whitespace-pre-wrap">{String(value)}</span>;
    default:
      return <span className="break-words">{String(value)}</span>;
  }
}

function Yes() {
  return (
    <span className="inline-flex items-center gap-1.5 text-success">
      <Check aria-hidden size={15} strokeWidth={2} />
      Да
    </span>
  );
}

function No() {
  return (
    <span className="inline-flex items-center gap-1.5 text-subtle">
      <Minus aria-hidden size={15} strokeWidth={2} />
      Нет
    </span>
  );
}
