import type { OrderStageStatus, OrderStatus } from '@webmotiv/shared';
import { Check } from 'lucide-react';
import { Badge } from '../../components/badge.tsx';
import { cx } from '../../components/ui.tsx';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  if (status === 'completed') return <Badge tone="success">Завершён</Badge>;
  if (status === 'cancelled') return <Badge>Отменён</Badge>;
  return <Badge tone="accent">В работе</Badge>;
}

/** Кружок этапа: выполнен — галочка, открыт — акцентом, впереди — номер. */
export function StageMarker({ status, number }: { status: OrderStageStatus; number: number }) {
  return (
    <span
      aria-hidden
      className={cx(
        'tabular grid size-6 shrink-0 place-items-center rounded-full text-xs font-medium',
        status === 'done' && 'bg-success-soft text-success',
        status === 'active' && 'bg-accent text-accent-fg',
        status === 'pending' && 'border border-line-strong text-subtle',
      )}
    >
      {status === 'done' ? <Check size={13} strokeWidth={2.5} /> : number}
    </span>
  );
}
