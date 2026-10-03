import { cx } from './ui.tsx';

export interface Segment<T extends string> {
  value: T;
  label: string;
  /** Число справа от подписи (например, сколько записей в архиве). */
  count?: number;
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  segments: readonly Segment<T>[];
  onChange: (value: T) => void;
}

/** Переключатель видов списка: «Действующие · Архив». */
export function Segmented<T extends string>({
  label,
  value,
  segments,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-9 rounded-xl bg-sunken p-0.5">
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <button
            key={segment.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(segment.value)}
            className={cx(
              'flex cursor-pointer items-center gap-1.5 rounded-[10px] px-3 text-sm transition-colors duration-100',
              active ? 'bg-surface font-medium text-fg shadow-card' : 'text-muted hover:text-fg',
            )}
          >
            {segment.label}
            {segment.count !== undefined && segment.count > 0 && (
              <span className="tabular text-xs text-subtle">{segment.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
