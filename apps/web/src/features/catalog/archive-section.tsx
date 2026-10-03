import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Button } from '../../components/button.tsx';
import { ConfirmDialog } from '../../components/dialog.tsx';
import { Section } from '../../components/section.tsx';
import { Notice } from '../../components/ui.tsx';

interface ArchiveSectionProps {
  /** «этап», «шаблон» — в текстах кнопок и подтверждений. */
  noun: string;
  name: string;
  archived: boolean;
  /** Почему нельзя в архив; `null` — можно. */
  archiveBlocked: string | null;
  /** Почему нельзя удалить; `null` — можно. */
  deleteBlocked: string | null;
  onArchive: (archived: boolean) => void;
  onDelete: () => void;
  pending: boolean;
  error: string | undefined;
}

function ActionRow({ text, action }: { text: ReactNode; action: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <p className="min-w-0 flex-1 basis-64 text-[13px] text-subtle">{text}</p>
      {action}
    </div>
  );
}

/**
 * Архив и удаление этапа или шаблона (PLAN.md §3.5): использованное только архивируется —
 * из библиотеки уходит, но заказы и история его помнят.
 */
export function ArchiveSection({
  noun,
  name,
  archived,
  archiveBlocked,
  deleteBlocked,
  onArchive,
  onDelete,
  pending,
  error,
}: ArchiveSectionProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <Section title={archived ? 'В архиве' : 'Архив'}>
      <div className="flex flex-col gap-5">
        {archived ? (
          <ActionRow
            text={`Архивный ${noun} нельзя выбрать для новых заказов и нельзя изменить.`}
            action={
              <Button icon={ArchiveRestore} disabled={pending} onClick={() => onArchive(false)}>
                Восстановить
              </Button>
            }
          />
        ) : (
          <ActionRow
            text={archiveBlocked ?? `Убрать из списков, но сохранить для истории.`}
            action={
              <Button
                icon={Archive}
                disabled={pending || archiveBlocked !== null}
                onClick={() => onArchive(true)}
              >
                В архив
              </Button>
            }
          />
        )}
        <ActionRow
          text={deleteBlocked ?? `Ещё нигде не использовался — можно удалить совсем.`}
          action={
            <Button
              icon={Trash2}
              disabled={pending || deleteBlocked !== null}
              onClick={() => setConfirmDelete(true)}
            >
              Удалить
            </Button>
          }
        />
        {error && !confirmDelete && <Notice tone="error">{error}</Notice>}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        title={`Удалить ${noun} «${name}»?`}
        description="Отменить удаление нельзя."
        confirmLabel="Удалить"
        tone="danger"
        pending={pending}
        error={confirmDelete ? error : undefined}
      />
    </Section>
  );
}
