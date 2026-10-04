import { useLayoutEffect, useRef, useState } from 'react';
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

interface Thumb {
  left: number;
  width: number;
}

/** Переключатель видов списка: «Активные · Архив». Подложка переезжает к выбранному. */
export function Segmented<T extends string>({
  label,
  value,
  segments,
  onChange,
}: SegmentedProps<T>) {
  const buttons = useRef(new Map<T, HTMLButtonElement>());
  const [thumb, setThumb] = useState<Thumb | null>(null);
  // Первое появление подложки — без перелёта из нулевой позиции.
  const [animated, setAnimated] = useState(false);

  useLayoutEffect(() => {
    const button = buttons.current.get(value);
    if (!button) return;
    // Ширина кнопок меняется вместе с числом в архиве, поэтому подложку пересчитываем и при ресайзе.
    // offsetLeft/offsetWidth округляются до целых пикселей, а ширина подписи дробная —
    // из-за этого подложка недотягивала до края на долю пикселя. Берём точные размеры.
    const measure = () => {
      const rect = button.getBoundingClientRect();
      const track = button.parentElement;
      // Подложка позиционируется от внутреннего края рамки, поэтому вычитаем её толщину.
      const left = track ? rect.left - track.getBoundingClientRect().left - track.clientLeft : 0;
      setThumb({ left, width: rect.width });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(button);
    return () => observer.disconnect();
  }, [value, segments]);

  useLayoutEffect(() => {
    if (thumb && !animated) {
      const frame = requestAnimationFrame(() => setAnimated(true));
      return () => cancelAnimationFrame(frame);
    }
  }, [thumb, animated]);

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="relative flex h-9 items-stretch rounded-xl bg-line p-0.5 dark:bg-sunken"
    >
      {thumb && (
        <span
          aria-hidden
          style={{ width: thumb.width, transform: `translateX(${thumb.left}px)` }}
          className={cx(
            'pointer-events-none absolute inset-y-0.5 left-0 rounded-[9px] bg-surface',
            animated &&
              'transition-[transform,width] duration-250 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
          )}
        />
      )}
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <button
            key={segment.value}
            ref={(node) => {
              if (node) buttons.current.set(segment.value, node);
              else buttons.current.delete(segment.value);
            }}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(segment.value)}
            className={cx(
              'relative flex cursor-pointer items-center gap-1.5 rounded-[9px] px-3 text-sm transition-colors duration-150',
              active ? 'font-medium text-fg' : 'text-muted hover:text-fg',
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
