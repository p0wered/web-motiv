import { type ReactNode, useId } from 'react';
import { cx } from './ui.tsx';

interface RadioProps {
  name: string;
  checked: boolean;
  onSelect: () => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

/** Вариант выбора строкой списка — пара к Checkbox. */
export function Radio({ name, checked, onSelect, label, description, disabled }: RadioProps) {
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
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-description` : undefined}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cx(
          'mt-px grid size-4.5 shrink-0 place-items-center rounded-full border transition-colors duration-100',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
          checked ? 'border-accent bg-accent' : 'border-line-strong bg-surface',
        )}
      >
        {checked && <span className="size-1.5 rounded-full bg-accent-fg" />}
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
