import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { CARD, cx } from './ui.tsx';

export interface Column<T> {
  id: string;
  header: string;
  /** Ширина колонки в grid-template-columns: `minmax(200px, 2fr)`, `140px`. */
  width: string;
  cell: (row: T) => ReactNode;
}

interface TableProps<T> {
  label: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  /** Строка — ссылка на карточку записи. */
  rowHref?: (row: T) => string;
}

/**
 * Таблица в блоке — как в WebPricer: шапка — скруглённая серая плашка, строки разделены
 * линиями с отступами по краям, без сетки колонок.
 */
export function Table<T>({ label, columns, rows, rowKey, rowHref }: TableProps<T>) {
  const grid = { gridTemplateColumns: columns.map((column) => column.width).join(' ') };
  const rowClass = (index: number) =>
    cx(
      'relative grid min-h-13 items-center rounded-lg text-sm text-fg transition-colors duration-100',
      rowHref && 'hover:bg-row-hover focus-visible:bg-row-hover',
      index < rows.length - 1 &&
        'after:absolute after:inset-x-2.5 after:bottom-0 after:h-px after:bg-line',
    );

  return (
    <div className={cx(CARD, 'overflow-x-auto p-2')}>
      <div role="table" aria-label={label} className="min-w-[640px]">
        <div role="rowgroup" className="mb-1">
          <div role="row" className="grid h-8 items-center rounded-lg bg-sunken" style={grid}>
            {columns.map((column) => (
              <div
                key={column.id}
                role="columnheader"
                className="truncate px-2.5 text-[13px] text-subtle"
              >
                {column.header}
              </div>
            ))}
          </div>
        </div>
        <div role="rowgroup">
          {rows.map((row, index) => {
            const cells = columns.map((column) => (
              <div key={column.id} role="cell" className="min-w-0 px-2.5 py-2">
                {column.cell(row)}
              </div>
            ));
            const href = rowHref?.(row);
            return href ? (
              <Link key={rowKey(row)} to={href} role="row" className={rowClass(index)} style={grid}>
                {cells}
              </Link>
            ) : (
              <div key={rowKey(row)} role="row" className={rowClass(index)} style={grid}>
                {cells}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
