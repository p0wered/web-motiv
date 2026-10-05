import { Check } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { cx } from './ui.tsx';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  /** Пояснение под подписью — мелким серым. */
  description?: ReactNode;
  disabled?: boolean;
}

/**
 * Список флажков: между строками линия, короче строки на радиус скругления (rounded-lg) с обеих
 * сторон — чтобы подсветка строки при наведении и линия не расходились по краям.
 */
export const CHECKLIST =
  '-m-1.5 flex flex-col [&>label]:py-3 [&>label:not(:first-child)]:before:absolute [&>label:not(:first-child)]:before:inset-x-2 [&>label:not(:first-child)]:before:top-0 [&>label:not(:first-child)]:before:h-px [&>label:not(:first-child)]:before:bg-line';

/**
 * Флажок строкой списка: вся строка кликабельна, сам input — для клавиатуры и чтения с экрана.
 * Строка `relative`: скрытый input стоит внутри неё, и фокус на нём не прокручивает страницу.
 */
export function Checkbox({ checked, onChange, label, description, disabled }: CheckboxProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cx(
        'relative flex items-start gap-3 rounded-lg px-2.5 py-2 transition-colors duration-100',
        disabled ? 'opacity-60' : 'cursor-pointer hover:bg-row-hover',
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-description` : undefined}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cx(
          'mt-px grid size-4.5 shrink-0 place-items-center rounded-[5px] border transition-colors duration-100',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
          checked ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong bg-surface',
        )}
      >
        {checked && <Check size={12} strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span id={`${id}-label`} className="block text-sm text-fg">
          {label}
        </span>
        {description && (
          <span id={`${id}-description`} className="mt-0.5 block text-[13px] text-subtle">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
