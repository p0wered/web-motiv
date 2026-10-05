import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId } from 'react';
import { formatNumber } from '../lib/format.ts';
import { Button } from './button.tsx';
import { ON_PAGE } from './input.tsx';
import { Select } from './select.tsx';

/**
 * Номера страниц для показа: первая, последняя, текущая с соседями, между ними — пропуски.
 * Пропуск ставится только вместо двух и более страниц — иначе проще показать саму страницу.
 */
export function pageItems(page: number, pageCount: number): (number | 'gap')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  // Длина ряда постоянная (7), чтобы кнопки не прыгали при листании.
  const [start, end] =
    page <= 4
      ? [2, 5]
      : page >= pageCount - 3
        ? [pageCount - 4, pageCount - 1]
        : [page - 1, page + 1];
  const middle = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  return [
    1,
    ...(start > 2 ? (['gap'] as const) : []),
    ...middle,
    ...(end < pageCount - 1 ? (['gap'] as const) : []),
    pageCount,
  ];
}

/** Страница, на которой окажется та же верхняя строка при другом размере страницы. */
export function pageForSize(page: number, pageSize: number, nextSize: number): number {
  return Math.floor(((page - 1) * pageSize) / nextSize) + 1;
}

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  /** Варианты числа строк на странице; без них выбора нет. */
  pageSizes?: readonly number[];
  onPageSizeChange?: (pageSize: number) => void;
}

/** Номера страниц под списком, «1–50 из 1 234» и выбор числа строк. */
export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  pageSizes,
  onPageSizeChange,
}: PaginationProps) {
  const sizeId = useId();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = Math.min(total, (page - 1) * pageSize + 1);
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-1">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <p className="tabular text-[13px] text-subtle">
          {formatNumber(from)}–{formatNumber(to)} из {formatNumber(total)}
        </p>
        {pageSizes && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <label htmlFor={sizeId} className="text-[13px] text-subtle">
              Строк на странице
            </label>
            <div className="relative w-20">
              <Select
                id={sizeId}
                value={String(pageSize)}
                options={pageSizes.map((size) => ({ value: String(size), label: String(size) }))}
                onChange={(value) => onPageSizeChange(Number(value))}
                className={`tabular h-9! rounded-xl! pt-0! text-[13px] ${ON_PAGE}`}
              />
            </div>
          </div>
        )}
      </div>
      {pageCount > 1 && (
        <nav aria-label="Страницы" className="flex items-center gap-1">
          <Button
            variant="ghost"
            icon={ChevronLeft}
            aria-label="Предыдущая страница"
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
          />
          {pageItems(page, pageCount).map((item, index) =>
            item === 'gap' ? (
              <span key={`gap-${index}`} aria-hidden className="w-6 text-center text-subtle">
                …
              </span>
            ) : (
              <Button
                key={item}
                variant="ghost"
                pressed={item === page}
                aria-current={item === page ? 'page' : undefined}
                aria-label={`Страница ${item}`}
                className="tabular min-w-9"
                onClick={() => item !== page && onChange(item)}
              >
                {item}
              </Button>
            ),
          )}
          <Button
            variant="ghost"
            icon={ChevronRight}
            aria-label="Следующая страница"
            disabled={page >= pageCount}
            onClick={() => onChange(page + 1)}
          />
        </nav>
      )}
    </div>
  );
}
