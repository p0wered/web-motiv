import { SELECT_OPTION_LIMIT, type SelectOption } from '@webmotiv/shared';
import { Plus, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '../../components/button.tsx';
import { newId } from '../../lib/id.ts';

const OPTION_INPUT =
  'h-9 min-w-0 flex-1 rounded-lg border border-transparent bg-sunken px-2.5 text-sm text-fg outline-none ' +
  'transition-colors placeholder:text-subtle focus:border-accent focus:bg-surface';

interface OptionsEditorProps {
  options: SelectOption[];
  onChange: (options: SelectOption[]) => void;
}

/** Варианты выбора: Enter в варианте — следующий вариант. */
export function OptionsEditor({ options, onChange }: OptionsEditorProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const focusId = useRef<string | null>(null);

  useEffect(() => {
    if (!focusId.current) return;
    listRef.current?.querySelector<HTMLInputElement>(`[data-option="${focusId.current}"]`)?.focus();
    focusId.current = null;
  });

  const add = (after?: number) => {
    const option = { id: newId(), label: '' };
    focusId.current = option.id;
    const next = [...options];
    next.splice(after === undefined ? next.length : after + 1, 0, option);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <p className="px-1 text-[13px] text-subtle">Варианты</p>
      <ul ref={listRef} className="flex flex-col gap-1.5">
        {options.map((option, index) => (
          <li key={option.id} className="flex items-center gap-1">
            <input
              data-option={option.id}
              value={option.label}
              aria-label={`Вариант ${index + 1}`}
              placeholder={`Вариант ${index + 1}`}
              onChange={(event) =>
                onChange(
                  options.map((item) =>
                    item.id === option.id ? { ...item, label: event.target.value } : item,
                  ),
                )
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (options.length < SELECT_OPTION_LIMIT) add(index);
                }
              }}
              className={OPTION_INPUT}
            />
            <Button
              variant="ghost"
              icon={X}
              aria-label={`Удалить вариант ${index + 1}`}
              title="Удалить вариант"
              disabled={options.length <= 1}
              onClick={() => onChange(options.filter((item) => item.id !== option.id))}
            />
          </li>
        ))}
      </ul>
      <div>
        <Button
          variant="ghost"
          icon={Plus}
          disabled={options.length >= SELECT_OPTION_LIMIT}
          onClick={() => add()}
        >
          Добавить вариант
        </Button>
      </div>
    </div>
  );
}
