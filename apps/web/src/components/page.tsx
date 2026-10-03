import { type ReactNode, useEffect } from 'react';
import { cx } from './ui.tsx';

interface PageProps {
  title: string;
  /** Пояснение под заголовком страницы. */
  description?: ReactNode;
  /** Справа от заголовка — главные действия страницы. */
  actions?: ReactNode;
  /** `narrow` — одна колонка для форм и настроек, `wide` — списки и заказ. */
  width?: 'narrow' | 'wide';
  children: ReactNode;
}

/** Страница внутри оболочки: крупный заголовок слева и блоки под ним. */
export function Page({ title, description, actions, width = 'wide', children }: PageProps) {
  useEffect(() => {
    document.title = `${title} — WebMotiv`;
  }, [title]);

  return (
    <div
      className={cx(
        'flex w-full flex-col gap-6 px-3 pt-3 pb-12',
        width === 'narrow' ? 'mx-auto max-w-[680px]' : 'max-w-[1400px]',
      )}
    >
      <header className="flex min-h-9 flex-wrap items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg">{title}</h1>
          {description && <p className="mt-1 text-[13px] text-subtle">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}
