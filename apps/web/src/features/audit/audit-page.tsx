import { EVENT_GROUPS, type EventGroup } from '@webmotiv/shared';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { EVENTS_PAGE_SIZE, EVENTS_PAGE_SIZES, useEvents } from '../../api/events.ts';
import { ON_PAGE } from '../../components/input.tsx';
import { Page } from '../../components/page.tsx';
import { Pagination, pageForSize } from '../../components/pagination.tsx';
import { Select, type SelectOption } from '../../components/select.tsx';
import { EmptyState, LoadError, Loading } from '../../components/status.tsx';
import { CARD, cx, Field } from '../../components/ui.tsx';
import { formatDateTime } from '../../lib/format.ts';
import { readStored, writeStored } from '../../lib/storage.ts';
import { describeActor, describeEvent, isWarning } from './event-text.ts';

type GroupFilter = EventGroup | 'all';

/** Колонки строки события — общие для шапки и строк. */
const COLUMNS = 'sm:grid-cols-[150px_200px_1fr_auto]';

const GROUP_OPTIONS: SelectOption<GroupFilter>[] = [
  { value: 'all', label: 'Все события' },
  { value: 'auth', label: 'Входы и пароли' },
  { value: 'user', label: 'Сотрудники' },
  { value: 'role', label: 'Роли' },
  { value: 'stage', label: 'Этапы' },
  { value: 'template', label: 'Шаблоны' },
  { value: 'order', label: 'Заказы' },
];

const PAGE_SIZE_KEY = 'webmotiv.audit.pageSize';

/** Число строк — личная настройка: запоминается в браузере. */
function storedPageSize(): number {
  const stored = Number(readStored(PAGE_SIZE_KEY));
  return (EVENTS_PAGE_SIZES as readonly number[]).includes(stored) ? stored : EVENTS_PAGE_SIZE;
}

const isGroup = (value: string | null): value is EventGroup =>
  (EVENT_GROUPS as readonly (string | null)[]).includes(value);

export function AuditPage() {
  // Фильтр и страница — в адресе: работают «назад», обновление страницы и ссылка коллеге.
  const [params, setParams] = useSearchParams();
  const groupParam = params.get('group');
  const group: GroupFilter = isGroup(groupParam) ? groupParam : 'all';
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1);
  const [pageSize, setPageSize] = useState(storedPageSize);
  const events = useEvents({ page, pageSize, group: group === 'all' ? undefined : group });
  const items = events.data?.items ?? [];
  const total = events.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const go = (next: { page?: number; group?: GroupFilter }) => {
    const nextGroup = next.group ?? group;
    const nextPage = next.page ?? 1;
    setParams(
      {
        ...(nextGroup !== 'all' ? { group: nextGroup } : {}),
        ...(nextPage > 1 ? { page: String(nextPage) } : {}),
      },
      { replace: next.group !== undefined },
    );
  };

  const changePage = (next: number) => {
    go({ page: next });
    document.querySelector('main')?.scrollTo({ top: 0 });
  };

  // Та же верхняя строка остаётся на экране — меняется только номер страницы.
  const changePageSize = (next: number) => {
    writeStored(PAGE_SIZE_KEY, next === EVENTS_PAGE_SIZE ? null : String(next));
    setPageSize(next);
    go({ page: pageForSize(page, pageSize, next) });
  };

  // Страницы с таким номером уже нет (событий стало меньше по фильтру) — на последнюю.
  const outOfRange = events.data !== undefined && !events.isPlaceholderData && page > pageCount;
  useEffect(() => {
    if (outOfRange)
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (pageCount > 1) next.set('page', String(pageCount));
          else next.delete('page');
          return next;
        },
        { replace: true },
      );
  }, [outOfRange, pageCount, setParams]);

  return (
    <Page
      title="Журнал"
      description="Входы, действия с заказами и изменения настроек"
      actions={
        <div className="w-56">
          <Field label="Показать">
            {({ id }) => (
              <Select
                id={id}
                value={group}
                options={GROUP_OPTIONS}
                onChange={(value) => go({ group: value })}
                className={cx('rounded-xl', ON_PAGE)}
              />
            )}
          </Field>
        </div>
      }
    >
      {events.isPending && <Loading />}
      {events.isError && <LoadError error={events.error} onRetry={() => void events.refetch()} />}
      {events.data && items.length === 0 && <EmptyState title="Событий нет" />}
      {items.length > 0 && (
        <div
          className={cx(
            CARD,
            'p-2 transition-opacity duration-150',
            events.isPlaceholderData && 'opacity-60',
          )}
        >
          <div
            aria-hidden
            className={cx(
              'mb-1 grid h-8 items-center gap-x-4 rounded-lg bg-sunken px-2.5 text-[13px] text-subtle max-sm:hidden',
              COLUMNS,
            )}
          >
            <span>Дата</span>
            <span>Сотрудник</span>
            <span>Событие</span>
            <span className="text-right">IP-адрес</span>
          </div>
          <ol aria-label="События">
            {items.map((event, index) => (
              <li
                key={event.id}
                className={cx(
                  'relative grid gap-x-4 gap-y-0.5 rounded-lg px-2.5 py-2.5 text-sm',
                  COLUMNS,
                  index < items.length - 1 &&
                    'after:absolute after:inset-x-2.5 after:bottom-0 after:h-px after:bg-line',
                )}
              >
                <time dateTime={event.at} className="tabular text-[13px] text-subtle">
                  {formatDateTime(event.at)}
                </time>
                <span className="truncate font-medium text-fg">{describeActor(event)}</span>
                <span className={cx('min-w-0', isWarning(event) ? 'text-danger' : 'text-fg')}>
                  {describeEvent(event)}
                </span>
                <span className="tabular text-[13px] text-subtle sm:text-right">{event.ip}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {items.length > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onChange={changePage}
          pageSizes={EVENTS_PAGE_SIZES}
          onPageSizeChange={changePageSize}
        />
      )}
    </Page>
  );
}
