import type { OrderListView } from '@webmotiv/shared';
import { Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useDirectory, useOrders } from '../../api/orders.ts';
import { useTemplates } from '../../api/templates.ts';
import { useCan, useCurrentUser } from '../../app/session.tsx';
import { buttonClasses } from '../../components/button.tsx';
import { Page } from '../../components/page.tsx';
import { Segmented } from '../../components/segmented.tsx';
import { Select } from '../../components/select.tsx';
import { OrdersTable } from './orders-table.tsx';

const VIEWS: { value: OrderListView; label: string }[] = [
  { value: 'active', label: 'В работе' },
  { value: 'completed', label: 'Завершённые' },
  { value: 'cancelled', label: 'Отменённые' },
  { value: 'all', label: 'Все' },
];

/** Поиск отправляется, когда сотрудник перестал печатать. */
function useDebounced(value: string, delay = 300): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// Фильтр — компактный, как строка поиска: высоту и отступ поля формы перекрываем.
const FILTER_SELECT = 'h-9! rounded-xl! pt-0! text-[13px]';

export function OrdersPage() {
  const me = useCurrentUser();
  const canCreate = useCan('orders.create');
  const canReadTemplates = useCan('orders.create', 'templates.manage');
  const [view, setView] = useState<OrderListView>('active');
  const [search, setSearch] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const query = useOrders({
    view,
    search: useDebounced(search.trim()),
    ...(templateId ? { templateId: Number(templateId) } : {}),
    ...(responsibleId ? { responsibleId: Number(responsibleId) } : {}),
  });
  const templates = useTemplates();
  const users = useDirectory();

  return (
    <Page
      title="Заказы"
      actions={
        canCreate && (
          <Link to="/orders/new" className={buttonClasses({ variant: 'primary', rounded: 'xl' })}>
            <Plus aria-hidden size={15} strokeWidth={1.75} />
            Новый заказ
          </Link>
        )
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Какие заказы показать" value={view} onChange={setView} segments={VIEWS} />
        <label className="relative min-w-56 flex-1 sm:max-w-80">
          <span className="sr-only">Поиск по номеру и покупателю</span>
          <Search
            aria-hidden
            size={15}
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Номер или покупатель"
            className="h-9 w-full rounded-xl border border-transparent bg-surface pr-3 pl-9 text-sm text-fg outline-none placeholder:text-subtle focus:border-accent"
          />
        </label>
        {canReadTemplates && (
          <div className="relative w-52">
            <Select
              id="orders-template"
              aria-label="Шаблон"
              value={templateId}
              onChange={setTemplateId}
              className={FILTER_SELECT}
              options={[
                { value: '', label: 'Все шаблоны' },
                ...(templates.data ?? []).map((template) => ({
                  value: String(template.id),
                  label: template.name,
                })),
              ]}
            />
          </div>
        )}
        <div className="relative w-52">
          <Select
            id="orders-responsible"
            aria-label="Ответственный"
            value={responsibleId}
            onChange={setResponsibleId}
            className={FILTER_SELECT}
            options={[
              { value: '', label: 'Все ответственные' },
              { value: String(me.id), label: 'Я' },
              ...(users.data ?? [])
                .filter((user) => user.id !== me.id)
                .map((user) => ({ value: String(user.id), label: user.fullName })),
            ]}
          />
        </div>
      </div>
      <OrdersTable
        query={query}
        empty={{
          title: search || templateId || responsibleId ? 'Ничего не нашлось' : 'Заказов нет',
        }}
      />
    </Page>
  );
}
