import { useParams, useSearchParams } from 'react-router';
import { useDirectory, useOrder } from '../../api/orders.ts';
import { Page } from '../../components/page.tsx';
import { LoadError, Loading } from '../../components/status.tsx';
import { OrderHistory } from './order-history.tsx';
import { OrderInfo } from './order-info.tsx';
import { OrderStatusBadge } from './order-status.tsx';
import { StageList } from './stage-list.tsx';
import { StagePanel } from './stage-panel.tsx';

/**
 * Карточка заказа: слева — этапы по порядку, в центре — выбранный этап, справа — шапка и
 * история. По умолчанию выбран текущий этап; выбор хранится в адресе (?stage=).
 */
export function OrderPage() {
  const id = Number(useParams().id);
  const order = useOrder(id);
  const users = useDirectory();
  const [params, setParams] = useSearchParams();

  const data = order.data;
  const fallback =
    data?.stages.find((stage) => stage.status === 'active') ?? data?.stages.at(-1) ?? null;
  const selected =
    data?.stages.find((stage) => String(stage.id) === params.get('stage')) ?? fallback;

  return (
    <Page
      title={data ? `Заказ ${data.number}` : 'Заказ'}
      description={
        data && (
          <span className="flex flex-wrap items-center gap-2">
            {data.customer}
            <OrderStatusBadge status={data.status} />
          </span>
        )
      }
      back={{ to: '/orders', label: 'Заказы' }}
    >
      {order.isPending && <Loading />}
      {order.isError && <LoadError error={order.error} onRetry={() => void order.refetch()} />}
      {data && selected && (
        <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_300px]">
          {/* Прилипает только в три колонки: в две под ним идут шапка и история во всю ширину. */}
          <div className="xl:sticky xl:top-6">
            <StageList
              order={data}
              selectedId={selected.id}
              onSelect={(stageId) =>
                setParams(stageId === fallback?.id ? {} : { stage: String(stageId) }, {
                  replace: true,
                })
              }
            />
          </div>
          <StagePanel key={selected.id} order={data} stage={selected} users={users.data ?? []} />
          <div className="flex flex-col gap-6 lg:col-span-2 xl:col-span-1">
            <OrderInfo order={data} users={users.data ?? []} />
            <OrderHistory events={data.history} />
          </div>
        </div>
      )}
    </Page>
  );
}
