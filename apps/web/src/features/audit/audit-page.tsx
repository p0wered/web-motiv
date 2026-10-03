import type { EventGroup } from '@webmotiv/shared';
import { useState } from 'react';
import { useEvents } from '../../api/events.ts';
import { Button } from '../../components/button.tsx';
import { Page } from '../../components/page.tsx';
import { Select, type SelectOption } from '../../components/select.tsx';
import { EmptyState, LoadError, Loading } from '../../components/status.tsx';
import { CARD, cx, Field } from '../../components/ui.tsx';
import { formatDateTime } from '../../lib/format.ts';
import { describeActor, describeEvent, isWarning } from './event-text.ts';

type GroupFilter = EventGroup | 'all';

const GROUP_OPTIONS: SelectOption<GroupFilter>[] = [
  { value: 'all', label: 'Все события' },
  { value: 'auth', label: 'Входы и пароли' },
  { value: 'user', label: 'Сотрудники' },
  { value: 'role', label: 'Роли' },
];

export function AuditPage() {
  const [group, setGroup] = useState<GroupFilter>('all');
  const events = useEvents({ group: group === 'all' ? undefined : group });
  const items = events.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Page
      title="Журнал"
      description="Кто, что и когда сделал. Записи нельзя изменить или удалить"
      actions={
        <div className="w-56">
          <Field label="Показать">
            {({ id }) => (
              <Select id={id} value={group} options={GROUP_OPTIONS} onChange={setGroup} />
            )}
          </Field>
        </div>
      }
    >
      {events.isPending && <Loading />}
      {events.isError && <LoadError error={events.error} onRetry={() => void events.refetch()} />}
      {events.data && items.length === 0 && <EmptyState title="Событий нет" />}
      {items.length > 0 && (
        <div className={cx(CARD, 'p-2')}>
          <ol aria-label="События">
            {items.map((event, index) => (
              <li
                key={event.id}
                className={cx(
                  'relative grid gap-x-4 gap-y-0.5 rounded-lg px-2.5 py-2.5 text-sm sm:grid-cols-[150px_200px_1fr_auto]',
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
          {events.hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button
                variant="ghost"
                disabled={events.isFetchingNextPage}
                onClick={() => void events.fetchNextPage()}
              >
                {events.isFetchingNextPage ? 'Загрузка…' : 'Показать ещё'}
              </Button>
            </div>
          )}
        </div>
      )}
    </Page>
  );
}
