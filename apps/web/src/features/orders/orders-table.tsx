import type { OrderSummary } from '@webmotiv/shared';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { Badge } from '../../components/badge.tsx';
import { Button } from '../../components/button.tsx';
import { EmptyState, LoadError, Loading } from '../../components/status.tsx';
import { type Column, Table } from '../../components/table.tsx';
import { formatDateTime } from '../../lib/format.ts';
import { executorLabel } from '../stages/executor-picker.tsx';
import { OrderStatusBadge } from './order-status.tsx';

const COLUMNS: Column<OrderSummary>[] = [
  {
    id: 'order',
    header: 'Заказ',
    width: 'minmax(220px, 2fr)',
    cell: (order) => (
      <span className="block min-w-0">
        <span className="tabular block font-medium">{order.number}</span>
        <span className="block truncate text-[13px] text-subtle">{order.customer}</span>
      </span>
    ),
  },
  {
    id: 'stage',
    header: 'Этап',
    width: 'minmax(220px, 2fr)',
    cell: (order) =>
      order.currentStage ? (
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0">
            <span className="block truncate">{order.currentStage.name}</span>
            <span className="tabular block text-[13px] text-subtle">
              {order.currentStage.position + 1} из {order.stageCount} ·{' '}
              {order.currentStage.executor === 'responsible'
                ? order.responsible.fullName
                : executorLabel(order.currentStage)}
            </span>
          </span>
          {order.waitingForMe && <Badge tone="accent">Ваш этап</Badge>}
        </span>
      ) : (
        <OrderStatusBadge status={order.status} />
      ),
  },
  {
    id: 'responsible',
    header: 'Ответственный',
    width: 'minmax(150px, 1fr)',
    cell: (order) => (
      <span className="block truncate text-[13px]">{order.responsible.fullName}</span>
    ),
  },
  {
    id: 'updated',
    header: 'Изменён',
    width: '150px',
    cell: (order) => (
      <span className="text-[13px] text-muted">{formatDateTime(order.updatedAt)}</span>
    ),
  },
];

type OrdersQuery = UseInfiniteQueryResult<
  InfiniteData<{ items: OrderSummary[]; nextBefore: number | null }>
>;

/** Таблица заказов с подгрузкой — для «Заказов» и «Моих задач». */
export function OrdersTable({
  query,
  empty,
}: {
  query: OrdersQuery;
  empty: { title: string; text?: string };
}) {
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  if (query.isPending) return <Loading />;
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  if (items.length === 0) return <EmptyState {...empty} />;
  return (
    <div className="flex flex-col gap-3">
      <Table
        label="Заказы"
        columns={COLUMNS}
        rows={items}
        rowKey={(order) => order.id}
        rowHref={(order) => `/orders/${order.id}`}
      />
      {query.hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? 'Загрузка…' : 'Показать ещё'}
          </Button>
        </div>
      )}
    </div>
  );
}
