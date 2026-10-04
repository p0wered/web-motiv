import { type ReactNode, useEffect, useId, useRef } from 'react';
import { Button } from './button.tsx';
import { cx, Notice } from './ui.tsx';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Кнопки справа внизу. */
  actions: ReactNode;
  /** `lg` — просмотр документа: почти на весь экран. */
  size?: 'md' | 'lg';
}

/**
 * Модальное окно на системном <dialog>: фокус внутри, Esc и клик мимо закрывают, фон
 * недоступен. Для подтверждения действий и разовых сообщений (временный пароль).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  size = 'md',
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cx(
        'm-auto rounded-2xl bg-surface p-0 text-fg shadow-popover backdrop:bg-black/35 dark:ring-1 dark:ring-line',
        size === 'lg'
          ? 'h-[min(900px,calc(100vh-32px))] w-[min(1000px,calc(100vw-32px))]'
          : 'w-[min(440px,calc(100vw-32px))]',
      )}
    >
      <div className={cx('flex flex-col gap-4 p-5', size === 'lg' && 'h-full')}>
        <div className="flex flex-col gap-1.5">
          <h2 id={titleId} className="text-[15px] font-semibold tracking-[-0.01em]">
            {title}
          </h2>
          {description && (
            <div className="text-[13px] leading-relaxed text-muted">{description}</div>
          )}
        </div>
        {children}
        <div className="flex flex-wrap justify-end gap-2">{actions}</div>
      </div>
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  /** `danger` — необратимое или опасное действие. */
  tone?: 'primary' | 'danger';
  pending?: boolean;
  error?: string | undefined;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  tone = 'primary',
  pending = false,
  error,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      actions={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant={tone} disabled={pending} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {error && <Notice tone="error">{error}</Notice>}
    </Dialog>
  );
}
