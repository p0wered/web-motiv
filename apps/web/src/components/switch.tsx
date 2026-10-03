import { cx } from './ui.tsx';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

/** Переключатель с подписью справа — как тема в меню: подпись тоже кликабельна. */
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2 text-[13px] text-muted transition-colors duration-100 hover:text-fg disabled:cursor-default disabled:opacity-60"
    >
      <span
        aria-hidden
        className={cx(
          'flex h-4 w-7 items-center rounded-full p-0.5 transition-colors duration-200 motion-reduce:transition-none',
          checked ? 'bg-accent' : 'bg-line-strong',
        )}
      >
        <span
          className={cx(
            'size-3 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.34,1.4,0.64,1)] motion-reduce:transition-none',
            checked && 'translate-x-3',
          )}
        />
      </span>
      {label}
    </button>
  );
}
