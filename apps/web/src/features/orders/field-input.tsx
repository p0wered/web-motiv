import type { DirectoryUser, StageField } from '@webmotiv/shared';
import { Checkbox } from '../../components/checkbox.tsx';
import { FIELD_INPUT, TextInput } from '../../components/input.tsx';
import { Select } from '../../components/select.tsx';
import { TextArea } from '../../components/textarea.tsx';
import { cx, Field } from '../../components/ui.tsx';
import type { DraftValue } from './field-draft.ts';

interface FieldInputProps {
  field: StageField;
  value: DraftValue;
  onChange: (value: DraftValue) => void;
  error: string | undefined;
  users: DirectoryUser[];
}

const labelOf = (field: StageField) => (field.required ? `${field.label} *` : field.label);

/** Поле этапа для заполнения — по его типу. Файлы — отдельно (FileField). */
export function FieldInput({ field, value, onChange, error, users }: FieldInputProps) {
  const hint = field.hint || undefined;
  const text = typeof value === 'string' ? value : '';

  if (field.type === 'checkbox') {
    return (
      <div className="-mx-2.5">
        <Checkbox
          checked={value === true}
          onChange={onChange}
          label={labelOf(field)}
          description={error ? <span className="text-danger">{error}</span> : hint}
        />
      </div>
    );
  }

  return (
    <Field label={labelOf(field)} error={error} hint={hint}>
      {({ id, describedBy, invalid }) => {
        const aria = { 'aria-describedby': describedBy, 'aria-invalid': invalid };
        switch (field.type) {
          case 'textarea':
            return (
              <TextArea
                id={id}
                value={text}
                rows={3}
                onChange={(e) => onChange(e.target.value)}
                {...aria}
              />
            );
          case 'number':
            return (
              <TextInput
                id={id}
                value={text}
                inputMode="decimal"
                className="tabular"
                onChange={(e) => onChange(e.target.value)}
                {...aria}
              />
            );
          case 'date':
            return (
              <input
                id={id}
                type="date"
                value={text}
                onChange={(e) => onChange(e.target.value)}
                className={cx(FIELD_INPUT, 'tabular')}
                {...aria}
              />
            );
          case 'select':
            return (
              <Select
                id={id}
                value={text}
                options={[
                  { value: '', label: '—' },
                  ...field.options.map((option) => ({ value: option.id, label: option.label })),
                ]}
                onChange={onChange}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            );
          case 'user': {
            // Заблокированного, если он уже выбран, оставляем в списке — иначе значение пропадёт.
            const options = users.filter((user) => user.isActive || String(user.id) === text);
            return (
              <Select
                id={id}
                value={text}
                options={[
                  { value: '', label: '—' },
                  ...options.map((user) => ({ value: String(user.id), label: user.fullName })),
                ]}
                onChange={onChange}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            );
          }
          default:
            return (
              <TextInput
                id={id}
                value={text}
                onChange={(e) => onChange(e.target.value)}
                {...aria}
              />
            );
        }
      }}
    </Field>
  );
}
