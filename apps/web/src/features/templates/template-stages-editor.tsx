import type { Stage } from '@webmotiv/shared';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '../../components/badge.tsx';
import { Button } from '../../components/button.tsx';
import { GripHandle, SortableList } from '../../components/sortable.tsx';
import { cx } from '../../components/ui.tsx';
import { executorLabel } from '../stages/executor-picker.tsx';
import { StagePickerDialog } from './stage-picker-dialog.tsx';

interface TemplateStagesEditorProps {
  stageIds: number[];
  onChange: (stageIds: number[]) => void;
  /** Библиотека этапов — для названий и исполнителей. */
  library: Stage[];
}

/** Последовательность этапов шаблона: перетаскивание, удаление, добавление из библиотеки. */
export function TemplateStagesEditor({ stageIds, onChange, library }: TemplateStagesEditorProps) {
  const [picking, setPicking] = useState(false);
  const byId = new Map(library.map((stage) => [stage.id, stage]));
  const items = stageIds.map((id) => ({ key: String(id), id, stage: byId.get(id) }));

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 ? (
        <p className="px-1 py-2 text-[13px] text-subtle">
          Добавьте этапы в том порядке, в каком идёт заказ.
        </p>
      ) : (
        <SortableList
          items={items}
          getId={(item) => item.key}
          onReorder={(next) => onChange(next.map((item) => item.id))}
          className="-my-1.5"
          itemClassName={(dragging, index) =>
            cx(
              'rounded-xl',
              index > 0 &&
                !dragging &&
                'before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-line',
              dragging && 'bg-surface px-2 shadow-popover',
            )
          }
        >
          {(item, index, handle) => (
            <div className="flex items-center gap-1.5 py-1.5">
              <GripHandle handle={handle} label={`Переместить этап «${item.stage?.name ?? ''}»`} />
              <span className="tabular grid size-8 shrink-0 place-items-center rounded-lg bg-sunken text-[13px] font-medium text-muted">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 px-1.5">
                {item.stage ? (
                  <Link
                    to={`/stages/${item.id}`}
                    className="block truncate text-sm font-medium text-fg hover:text-accent"
                  >
                    {item.stage.name}
                  </Link>
                ) : (
                  <span className="text-sm text-danger">Этап удалён</span>
                )}
              </span>
              {item.stage && (
                <Badge tone={item.stage.executor === 'responsible' ? 'accent' : 'neutral'}>
                  {executorLabel(item.stage)}
                </Badge>
              )}
              <Button
                variant="ghost"
                icon={X}
                aria-label={`Убрать этап «${item.stage?.name ?? ''}» из шаблона`}
                title="Убрать из шаблона"
                onClick={() => onChange(stageIds.filter((id) => id !== item.id))}
              />
            </div>
          )}
        </SortableList>
      )}
      <div className={cx(items.length > 0 && 'pt-1')}>
        <Button variant="ghost" icon={Plus} onClick={() => setPicking(true)}>
          Добавить этапы
        </Button>
      </div>
      <StagePickerDialog
        open={picking}
        onClose={() => setPicking(false)}
        selected={stageIds}
        onAdd={(stage) => onChange([...stageIds, stage.id])}
      />
    </div>
  );
}
