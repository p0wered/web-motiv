import { STAGE_FIELD_TYPE_LABELS, type StageField, type StageFieldType } from '@webmotiv/shared';
import { ChevronDown, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/button.tsx';
import { Checkbox } from '../../components/checkbox.tsx';
import { TextInput } from '../../components/input.tsx';
import { Reveal } from '../../components/reveal.tsx';
import { Select } from '../../components/select.tsx';
import { type DragHandle, GripHandle } from '../../components/sortable.tsx';
import { Switch } from '../../components/switch.tsx';
import { cx, Field } from '../../components/ui.tsx';
import { FIELD_TYPE_ICONS, FIELD_TYPE_OPTIONS, withType } from './field-types.ts';
import { OptionsEditor } from './options-editor.tsx';

interface FieldEditorProps {
  field: StageField;
  onChange: (field: StageField) => void;
  onRemove: () => void;
  handle: DragHandle;
  error: string | undefined;
  /** Только что добавленное поле: фокус в название, настройки раскрыты. */
  isNew: boolean;
}

/**
 * Поле этапа строкой: ручка, тип, название (редактируется на месте), обязательность. Подсказка,
 * смена типа и варианты — в раскрывающихся настройках.
 */
export function FieldEditor({ field, onChange, onRemove, handle, error, isNew }: FieldEditorProps) {
  const [expanded, setExpanded] = useState(isNew && field.type === 'select');
  const labelRef = useRef<HTMLInputElement>(null);
  const Icon = FIELD_TYPE_ICONS[field.type];
  const errorId = `${field.id}-error`;

  useEffect(() => {
    if (isNew) labelRef.current?.focus();
  }, [isNew]);

  return (
    <div className="py-1.5">
      <div className="flex items-center gap-1.5">
        <GripHandle handle={handle} label={`Переместить поле «${field.label || 'без названия'}»`} />
        <span
          title={STAGE_FIELD_TYPE_LABELS[field.type]}
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-sunken text-subtle"
        >
          <Icon aria-hidden size={15} strokeWidth={1.75} />
        </span>
        <input
          ref={labelRef}
          value={field.label}
          onChange={(event) => onChange({ ...field, label: event.target.value })}
          placeholder="Название поля"
          aria-label="Название поля"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={cx(
            'h-9 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2.5 text-sm font-medium text-fg outline-none',
            'transition-colors placeholder:font-normal placeholder:text-subtle hover:bg-sunken',
            'focus:border-accent focus:bg-surface aria-[invalid=true]:border-danger',
          )}
        />
        <span className="w-28 shrink-0 truncate text-[13px] text-subtle max-md:hidden">
          {STAGE_FIELD_TYPE_LABELS[field.type]}
        </span>
        <Switch
          checked={field.required}
          onChange={(required) => onChange({ ...field, required })}
          label="Обязательное"
        />
        <Button
          variant="ghost"
          icon={ChevronDown}
          aria-label="Настройки поля"
          title="Настройки поля"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="[&_svg]:transition-transform aria-expanded:[&_svg]:rotate-180"
        />
        <Button
          variant="ghost"
          icon={Trash2}
          aria-label={`Удалить поле «${field.label || 'без названия'}»`}
          title="Удалить поле"
          onClick={onRemove}
          className="hover:border-danger/50 hover:bg-danger-soft hover:text-danger hover:[&_svg]:text-danger"
        />
      </div>
      {error && (
        <p id={errorId} className="mt-1 pl-17 text-[13px] text-danger">
          {error}
        </p>
      )}
      <Reveal open={expanded}>
        <div className="flex flex-col gap-3 pt-2 pb-1.5 pl-17">
          <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
            <Field label="Тип">
              {({ id }) => (
                <Select<StageFieldType>
                  id={id}
                  value={field.type}
                  options={FIELD_TYPE_OPTIONS}
                  onChange={(type) => onChange(withType(field, type))}
                />
              )}
            </Field>
            <Field label="Подсказка исполнителю">
              {({ id, describedBy }) => (
                <TextInput
                  id={id}
                  value={field.hint}
                  onChange={(event) => onChange({ ...field, hint: event.target.value })}
                  aria-describedby={describedBy}
                />
              )}
            </Field>
          </div>
          {field.type === 'select' && (
            <OptionsEditor
              options={field.options}
              onChange={(options) => onChange({ ...field, options })}
            />
          )}
          {field.type === 'file' && (
            <div className="-mx-2.5">
              <Checkbox
                checked={field.multiple}
                onChange={(multiple) => onChange({ ...field, multiple })}
                label="Можно загрузить несколько файлов"
              />
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
}
