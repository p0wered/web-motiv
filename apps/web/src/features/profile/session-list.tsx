import type { SessionInfo } from '@webmotiv/shared';
import { Monitor } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '../../components/badge.tsx';
import { cx } from '../../components/ui.tsx';
import { describeUserAgent, formatDateTime } from '../../lib/format.ts';

interface SessionListProps {
  sessions: SessionInfo[];
  /** Действие у сеанса справа (например, «Завершить»). */
  action?: (session: SessionInfo) => ReactNode;
  empty: string;
}

/** Сеансы входа: устройство, адрес, когда вошли и когда были активны. */
export function SessionList({ sessions, action, empty }: SessionListProps) {
  if (sessions.length === 0) return <p className="px-1 text-[13px] text-subtle">{empty}</p>;
  return (
    <ul className="-my-1.5 flex flex-col">
      {sessions.map((session, index) => (
        <li
          key={session.id}
          className={cx(
            'relative flex items-center gap-3 py-2.5',
            index < sessions.length - 1 &&
              'after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-line',
          )}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sunken text-subtle">
            <Monitor aria-hidden size={16} strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-sm text-fg">
              {describeUserAgent(session.userAgent)}
              {session.current && <Badge tone="accent">Этот сеанс</Badge>}
            </p>
            <p className="truncate text-[13px] text-subtle">
              {[
                session.ip,
                `вход ${formatDateTime(session.createdAt)}`,
                `активность ${formatDateTime(session.lastSeenAt)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          {action?.(session)}
        </li>
      ))}
    </ul>
  );
}
