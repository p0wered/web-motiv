import { STAGE_FIELD_LIMIT, type StageField } from '@webmotiv/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { MenuButton } from '../../components/menu.tsx';
import { SortableList } from '../../components/sortable.tsx';
import { cx } from '../../components/ui.tsx';
import { FieldEditor } from './field-editor.tsx';
import { createField, FIELD_TYPE_OPTIONS } from './field-types.ts';

interface FieldBuilderProps {
  fields: StageField[];
  onChange: (fields: StageField[]) => void;
  /** Ошибки по номеру поля — показываются после попытки сохранить. */
  errors: Map<number, string>;
}

/** Конструктор полей этапа: добавление по типу, перетаскивание, правка на месте. */
export function FieldBuilder({ fields, onChange, errors }: FieldBuilderProps) {
  const [newId, setNewId] = useState<string | null>(null);

  const add = (type: StageField['type']) => {
    const field = createField(type);
    setNewId(field.id);
    onChange([...fields, field]);
  };

  return (
    <div className="flex flex-col gap-2">
      {fields.length === 0 ? (
        <p className="px-1 py-2 text-[13px] text-subtle">
          Полей нет — исполнитель просто отметит этап «Готово».
        </p>
      ) : (
        <SortableList
          items={fields}
          getId={(field) => field.id}
          onReorder={onChange}
          className="-my-1.5"
          itemClassName={(dragging, index) =>
            cx(
              'rounded-xl',
              // Линия между полями — сверху у каждого, кроме первого; у перетаскиваемого — тень.
              index > 0 &&
                !dragging &&
                'before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-line',
              dragging && 'bg-surface px-2 shadow-popover',
            )
          }
        >
          {(field, index, handle) => (
            <FieldEditor
              field={field}
              handle={handle}
              isNew={field.id === newId}
              error={errors.get(index)}
              onChange={(updated) =>
                onChange(fields.map((item) => (item.id === field.id ? updated : item)))
              }
              onRemove={() => onChange(fields.filter((item) => item.id !== field.id))}
            />
          )}
        </SortableList>
      )}
      <div className={cx(fields.length > 0 && 'pt-1')}>
        {fields.length < STAGE_FIELD_LIMIT ? (
          <MenuButton
            label="Добавить поле"
            icon={Plus}
            variant="ghost"
            menuLabel="Тип поля"
            items={FIELD_TYPE_OPTIONS.map((option) => ({
              id: option.value,
              label: option.label,
              description: option.description,
              icon: option.icon,
              onSelect: () => add(option.value),
            }))}
          />
        ) : (
          <p className="px-1 text-[13px] text-subtle">Не больше {STAGE_FIELD_LIMIT} полей.</p>
        )}
      </div>
    </div>
  );
}
