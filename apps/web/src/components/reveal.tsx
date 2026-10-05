import { forwardRef, type ReactNode, useEffect, useState } from 'react';
import { cx } from './ui.tsx';

const MOTION = 'duration-250 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none';
/** Длительность раскрытия (duration-250) с запасом. */
const SETTLE_MS = 280;

interface RevealProps {
  open: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Плавно раскрывает содержимое по высоте (строка сетки 0fr → 1fr), раздвигая контент ниже,
 * и так же сворачивает. Свёрнутое остаётся в разметке, но inert — недоступно с клавиатуры
 * и для чтения с экрана.
 *
 * Содержимое обрезается только пока блок свёрнут или движется: раскрытый до конца блок не
 * обрезает выпадающие списки внутри и не прячет их под соседние строки (иначе список «Тип»
 * в настройках поля не виден).
 */
export const Reveal = forwardRef<HTMLDivElement, RevealProps>(function Reveal(
  { open, className, children },
  ref,
) {
  // «Раскрылся до конца» сбрасывается сразу при любом переключении и ставится после анимации.
  const [settled, setSettled] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    setSettled(false);
  }
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <div
      ref={ref}
      inert={!open}
      className={cx(
        'grid transition-[grid-template-rows]',
        MOTION,
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        className,
      )}
    >
      <div className={cx('min-h-0', !(open && settled) && 'overflow-hidden')}>
        <div
          className={cx(
            'transition-[opacity,translate]',
            MOTION,
            // Раскрытый до конца — без translate: он создаёт свой контекст наложения, и
            // выпадающий список внутри оказался бы под соседними строками.
            open ? (settled ? 'translate-none' : 'translate-y-0') : '-translate-y-1.5',
            open ? 'opacity-100' : 'opacity-0',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
});
