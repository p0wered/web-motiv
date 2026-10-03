import type { LucideIcon } from 'lucide-react';
import { Page } from '../../components/page.tsx';
import { CARD, cx } from '../../components/ui.tsx';

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Фаза плана (PLAN.md §10), в которой раздел заработает. */
  phase: number;
}

/** Раздел, который ещё не сделан: показывает, что здесь будет и когда. */
export function PlaceholderPage({ title, description, icon: Icon, phase }: PlaceholderPageProps) {
  return (
    <Page title={title} description={description}>
      <div
        className={cx(
          CARD,
          'flex flex-col items-center justify-center gap-3 px-6 py-20 text-center',
        )}
      >
        <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon aria-hidden size={20} strokeWidth={1.75} />
        </span>
        <p className="text-[15px] font-medium text-fg">Раздел в разработке</p>
        <p className="max-w-sm text-[13px] text-subtle">Появится в фазе {phase} плана.</p>
      </div>
    </Page>
  );
}
