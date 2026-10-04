import type { Order } from '@webmotiv/shared';
import { Badge } from '../../components/badge.tsx';
import { CARD, cx } from '../../components/ui.tsx';
import { shortName } from '../../lib/format.ts';
import { executorLabel } from '../stages/executor-picker.tsx';
import { StageMarker } from './order-status.tsx';

const STATUS_TEXT = { done: 'выполнен', active: 'в работе', pending: 'впереди' } as const;

/** Этапы заказа по порядку; выбранный показывается справа. */
export function StageList({
  order,
  selectedId,
  onSelect,
}: {
  order: Order;
  selectedId: number;
  onSelect: (stageId: number) => void;
}) {
  return (
    <nav aria-label="Этапы заказа" className={cx(CARD, 'p-1.5')}>
      <ol className="flex flex-col gap-0.5">
        {order.stages.map((stage, index) => {
          const selected = stage.id === selectedId;
          return (
            <li key={stage.id} className="relative">
              {/* Линия между кружками — путь заказа. */}
              {index < order.stages.length - 1 && (
                <span
                  aria-hidden
                  className={cx(
                    'absolute top-9 bottom-[-6px] left-[22px] w-px',
                    stage.status === 'done' ? 'bg-success/40' : 'bg-line',
                  )}
                />
              )}
              <button
                type="button"
                aria-current={selected ? 'step' : undefined}
                onClick={() => onSelect(stage.id)}
                className={cx(
                  'relative flex w-full cursor-pointer items-start gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-100',
                  selected ? 'bg-row-hover' : 'hover:bg-row-hover',
                )}
              >
                <StageMarker status={stage.status} number={index + 1} />
                <span className="min-w-0 flex-1">
                  <span
                    className={cx(
                      'block truncate text-sm',
                      stage.status === 'pending' ? 'text-muted' : 'text-fg',
                      selected && 'font-medium',
                    )}
                  >
                    {stage.name}
                    <span className="sr-only">, {STATUS_TEXT[stage.status]}</span>
                  </span>
                  <span className="block truncate text-xs text-subtle">
                    {stage.status === 'done'
                      ? shortName(stage.completedBy?.fullName ?? '')
                      : stage.executor === 'responsible'
                        ? shortName(order.responsible.fullName)
                        : executorLabel(stage)}
                  </span>
                </span>
                {stage.canEdit && <Badge tone="accent">Ваш</Badge>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
