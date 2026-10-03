import { ChevronLeft } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { Link } from 'react-router';
import { buttonClasses } from './button.tsx';
import { cx } from './ui.tsx';

interface PageProps {
  title: string;
  /** Пояснение под заголовком страницы. */
  description?: ReactNode;
  /** Справа от заголовка — главные действия страницы. */
  actions?: ReactNode;
  /** `narrow` — одна колонка для форм и настроек, `wide` — списки и заказ. */
  width?: 'narrow' | 'wide';
  /** Кнопка «назад» слева от заголовка — у вложенных страниц (сотрудник → список). */
  back?: { to: string; label: string };
  children: ReactNode;
}

/** Страница внутри оболочки: крупный заголовок слева и блоки под ним. */
export function Page({ title, description, actions, width = 'wide', back, children }: PageProps) {
  useEffect(() => {
    document.title = `${title} — WebMotiv`;
  }, [title]);

  // relative — точка отсчёта для кнопки «назад» у левого края области контента.
  return (
    <div className="relative">
      <div
        className={cx(
          'flex w-full flex-col gap-6 px-6 pt-6 pb-12',
          width === 'narrow' ? 'mx-auto max-w-[680px]' : 'max-w-[1400px]',
        )}
      >
        <header className="flex min-h-9 flex-wrap items-end justify-between gap-3 px-1">
          <div className="min-w-0">
            <div className="flex min-h-9 min-w-0 items-center gap-2">
              {back && (
                // У узкой страницы на широком экране кнопка с подписью прижата к левому краю
                // области контента, на одной высоте с заголовком; иначе — стрелка перед заголовком.
                <Link
                  to={back.to}
                  aria-label={`Назад: ${back.label}`}
                  title={back.label}
                  className={buttonClasses({
                    variant: 'ghost',
                    square: width !== 'narrow',
                    className: cx(
                      'text-muted',
                      width === 'narrow' &&
                        'max-lg:w-9 max-lg:px-0 lg:absolute lg:top-6 lg:left-6 lg:pl-2',
                    ),
                  })}
                >
                  <ChevronLeft aria-hidden size={18} strokeWidth={1.75} />
                  {width === 'narrow' && <span className="max-lg:hidden">{back.label}</span>}
                </Link>
              )}
              <h1 className="min-w-0 truncate text-2xl font-semibold tracking-[-0.02em] text-fg">
                {title}
              </h1>
            </div>
            {description && <p className="mt-1 text-[13px] text-subtle">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
        {children}
      </div>
    </div>
  );
}
