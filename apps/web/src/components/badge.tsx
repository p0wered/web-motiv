import type { ReactNode } from 'react';
import { cx } from './ui.tsx';

type BadgeTone = 'neutral' | 'accent' | 'success' | 'danger';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-sunken text-muted',
  accent: 'bg-accent-soft text-accent-text',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
};

/** Метка: роль, статус. */
export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex h-5.5 shrink-0 items-center rounded-lg px-2 text-xs font-medium whitespace-nowrap',
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
