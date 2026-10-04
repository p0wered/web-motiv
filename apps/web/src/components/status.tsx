import { Loader2 } from 'lucide-react';
import { Button } from './button.tsx';
import { CARD, cx, Notice } from './ui.tsx';

/** Загрузка содержимого страницы. */
export function Loading({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <p className="flex items-center gap-2 px-1 text-[13px] text-subtle" aria-busy>
      <Loader2 aria-hidden size={15} className="animate-spin" />
      {label}
    </p>
  );
}

/** Ошибка загрузки с повтором. */
export function LoadError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Notice tone="error">{error.message}</Notice>
      <Button onClick={onRetry}>Повторить</Button>
    </div>
  );
}

/** Пустой список: что здесь будет и что сделать. */
export function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <div className={cx(CARD, 'flex flex-col items-center gap-1.5 px-6 py-14 text-center')}>
      <p className="text-[15px] text-subtle">{title}</p>
      {text && <p className="max-w-sm text-[13px] text-subtle">{text}</p>}
    </div>
  );
}
