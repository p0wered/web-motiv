import type { AuditEvent } from '@webmotiv/shared';
import { Section } from '../../components/section.tsx';
import { cx } from '../../components/ui.tsx';
import { formatDateTime } from '../../lib/format.ts';

type Payload = Record<string, unknown>;
const str = (value: unknown) => (typeof value === 'string' ? value : '');
const list = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);

/** Событие заказа коротко: номер заказа здесь не нужен — мы и так в нём. */
function describe(event: AuditEvent): string {
  const payload = (event.payload ?? {}) as Payload;
  switch (event.action) {
    case 'order.created':
      return 'Заказ создан';
    case 'order.updated': {
      const changes = (payload.changes ?? {}) as Payload;
      const responsible = changes.responsible as Payload | undefined;
      if (responsible) return `Ответственный: ${str(responsible.to)}`;
      return 'Шапка заказа изменена';
    }
    case 'order.stage_saved':
      return `«${str(payload.stage)}»: сохранено — ${list(payload.fields).join(', ')}`;
    case 'order.stage_completed':
      return `«${str(payload.stage)}» выполнен`;
    case 'order.completed':
      return 'Заказ завершён';
    case 'order.cancelled':
      return `Заказ отменён${str(payload.reason) ? `: ${str(payload.reason)}` : ''}`;
    case 'order.file_uploaded':
      return `«${str(payload.stage)}»: прикреплён файл ${str(payload.name)}`;
    case 'order.file_deleted':
      return `«${str(payload.stage)}»: удалён файл ${str(payload.name)}`;
    case 'order.file_downloaded':
      return `${payload.inline ? 'Открыт' : 'Скачан'} файл ${str(payload.name)}`;
    default:
      return event.action;
  }
}

/** История заказа: кто и что делал, от новых к старым. Просмотры файлов — тоже здесь. */
export function OrderHistory({ events }: { events: AuditEvent[] }) {
  return (
    <Section title="История">
      {events.length === 0 ? (
        <p className="text-[13px] text-subtle">Пока пусто.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {events.map((event) => (
            <li key={event.id} className="flex flex-col gap-0.5">
              <span
                className={cx(
                  'text-sm',
                  event.action === 'order.file_downloaded' ? 'text-muted' : 'text-fg',
                )}
              >
                {describe(event)}
              </span>
              <span className="text-xs text-subtle">
                {event.actor?.fullName ?? 'Система'} · {formatDateTime(event.at)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
