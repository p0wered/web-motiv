import { plural, type Stage } from '@webmotiv/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useStages } from '../../api/stages.ts';
import { Badge } from '../../components/badge.tsx';
import { buttonClasses } from '../../components/button.tsx';
import { Page } from '../../components/page.tsx';
import { Segmented } from '../../components/segmented.tsx';
import { EmptyState, LoadError, Loading } from '../../components/status.tsx';
import { type Column, Table } from '../../components/table.tsx';
import { executorLabel } from './executor-picker.tsx';
import { FIELD_TYPE_ICONS } from './field-types.ts';

const COLUMNS: Column<Stage>[] = [
  {
    id: 'name',
    header: 'Этап',
    width: 'minmax(220px, 2fr)',
    cell: (stage) => (
      <span className="block min-w-0">
        <span className="block truncate font-medium">{stage.name}</span>
        {stage.description && (
          <span className="block truncate text-[13px] text-subtle">{stage.description}</span>
        )}
      </span>
    ),
  },
  {
    id: 'executor',
    header: 'Исполнитель',
    width: 'minmax(150px, 1fr)',
    cell: (stage) => (
      <Badge tone={stage.executor === 'responsible' ? 'accent' : 'neutral'}>
        {executorLabel(stage)}
      </Badge>
    ),
  },
  {
    id: 'fields',
    header: 'Поля',
    width: 'minmax(150px, 1fr)',
    cell: (stage) =>
      stage.fields.length === 0 ? (
        <span className="text-[13px] text-subtle">Только «Готово»</span>
      ) : (
        <span className="flex items-center gap-2 text-[13px] text-muted">
          <span className="flex text-subtle">
            {[...new Set(stage.fields.map((field) => field.type))].slice(0, 4).map((type) => {
              const Icon = FIELD_TYPE_ICONS[type];
              return (
                <Icon key={type} aria-hidden size={14} strokeWidth={1.75} className="-mr-0.5" />
              );
            })}
          </span>
          {stage.fields.length} {plural(stage.fields.length, ['поле', 'поля', 'полей'])}
        </span>
      ),
  },
  {
    id: 'templates',
    header: 'В шаблонах',
    width: 'minmax(180px, 2fr)',
    cell: (stage) => (
      <span className="line-clamp-2 text-[13px] text-muted">
        {stage.templates.map((template) => template.name).join(', ') || '—'}
      </span>
    ),
  },
];

type View = 'active' | 'archived';

export function StagesPage() {
  const stages = useStages();
  const [view, setView] = useState<View>('active');
  const archivedCount = stages.data?.filter((stage) => stage.archived).length ?? 0;
  const rows = stages.data?.filter((stage) => stage.archived === (view === 'archived')) ?? [];

  return (
    <Page
      title="Этапы"
      description="Шаги заказа: кто их выполняет и что заполняет"
      actions={
        <>
          <Segmented
            label="Какие этапы показать"
            value={view}
            onChange={setView}
            segments={[
              { value: 'active', label: 'Действующие' },
              { value: 'archived', label: 'Архив', count: archivedCount },
            ]}
          />
          <Link to="/stages/new" className={buttonClasses({ variant: 'primary' })}>
            <Plus aria-hidden size={15} strokeWidth={1.75} />
            Добавить этап
          </Link>
        </>
      }
    >
      {stages.isPending && <Loading />}
      {stages.isError && <LoadError error={stages.error} onRetry={() => void stages.refetch()} />}
      {stages.data && rows.length === 0 && (
        <EmptyState
          title={view === 'archived' ? 'Архив пуст' : 'Этапов пока нет'}
          text={
            view === 'archived'
              ? undefined
              : 'Этап — шаг заказа: например, «Счёт» или «Отгрузка». Из этапов собираются шаблоны.'
          }
        />
      )}
      {rows.length > 0 && (
        <Table
          label="Этапы"
          columns={COLUMNS}
          rows={rows}
          rowKey={(stage) => stage.id}
          rowHref={(stage) => `/stages/${stage.id}`}
        />
      )}
    </Page>
  );
}
