import { useOrders } from '../../api/orders.ts';
import { Page } from '../../components/page.tsx';
import { OrdersTable } from './orders-table.tsx';

/** Заказы, в которых сейчас открыт этап вошедшего сотрудника. */
export function TasksPage() {
  const query = useOrders({ view: 'active', tasks: 'true' });
  return (
    <Page title="Мои задачи" description="Заказы, в которых сейчас ваш этап">
      <OrdersTable query={query} empty={{ title: 'Задач пока нет' }} />
    </Page>
  );
}
