import type { Stage } from '@webmotiv/shared';
import { Check, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useStages } from '../../api/stages.ts';
import { Badge } from '../../components/badge.tsx';
import { Button, buttonClasses } from '../../components/button.tsx';
import { Dialog } from '../../components/dialog.tsx';
import { LoadError, Loading } from '../../components/status.tsx';
import { cx } from '../../components/ui.tsx';
import { executorLabel } from '../stages/executor-picker.tsx';

interface StagePickerDialogProps {
  open: boolean;
  onClose: () => void;
  /** Этапы, которые уже в шаблоне, — отмечены и не добавляются второй раз. */
  selected: number[];
  onAdd: (stage: Stage) => void;
}

/** Выбор этапов из библиотеки: поиск по названию, по клику этап добавляется в конец. */
export function StagePickerDialog({ open, onClose, selected, onAdd }: StagePickerDialogProps) {
  const stages = useStages();
  const [query, setQuery] = useState('');
  const { refetch } = stages;

  // Этап могли только что создать в соседней вкладке — при открытии список перечитывается.
  useEffect(() => {
    if (open) void refetch();
  }, [open, refetch]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ru');
    return (stages.data ?? []).filter(
      (stage) => !stage.archived && stage.name.toLocaleLowerCase('ru').includes(needle),
    );
  }, [stages.data, query]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Добавить этапы"
      description="Этап добавится в конец — порядок можно поменять перетаскиванием."
      actions={
        <>
          <Link
            to="/stages/new"
            target="_blank"
            rel="noopener"
            className={buttonClasses({ variant: 'ghost', className: 'mr-auto' })}
          >
            <Plus aria-hidden size={15} strokeWidth={1.75} />
            Новый этап
          </Link>
          <Button variant="primary" onClick={onClose}>
            Готово
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <label className="relative">
          <span className="sr-only">Поиск этапа</span>
          <Search
            aria-hidden
            size={15}
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти этап"
            className="h-10 w-full rounded-lg border border-transparent bg-sunken pr-3 pl-9 text-sm text-fg outline-none placeholder:text-subtle focus:border-accent focus:bg-surface"
          />
        </label>
        {stages.isPending && <Loading />}
        {stages.isError && <LoadError error={stages.error} onRetry={() => void refetch()} />}
        {stages.data && visible.length === 0 && (
          <p className="px-1 py-3 text-[13px] text-subtle">
            {query ? 'Ничего не нашлось.' : 'В библиотеке нет этапов.'}
          </p>
        )}
        <ul className="-mx-1 max-h-80 overflow-y-auto">
          {visible.map((stage) => {
            const added = selected.includes(stage.id);
            return (
              <li key={stage.id}>
                <button
                  type="button"
                  disabled={added}
                  onClick={() => onAdd(stage)}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                    added ? 'cursor-default' : 'cursor-pointer hover:bg-row-hover',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={cx('block truncate text-sm', added ? 'text-subtle' : 'text-fg')}
                    >
                      {stage.name}
                    </span>
                  </span>
                  <Badge tone={stage.executor === 'responsible' ? 'accent' : 'neutral'}>
                    {executorLabel(stage)}
                  </Badge>
                  <span className="grid size-5 shrink-0 place-items-center text-subtle">
                    {added ? (
                      <Check aria-label="Уже в шаблоне" size={15} strokeWidth={2} />
                    ) : (
                      <Plus aria-hidden size={15} strokeWidth={1.75} />
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Dialog>
  );
}
