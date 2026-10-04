import { plural, type Template } from '@webmotiv/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useTemplates } from '../../api/templates.ts';
import { buttonClasses } from '../../components/button.tsx';
import { Page } from '../../components/page.tsx';
import { Segmented } from '../../components/segmented.tsx';
import { EmptyState, LoadError, Loading } from '../../components/status.tsx';
import { type Column, Table } from '../../components/table.tsx';

const COLUMNS: Column<Template>[] = [
  {
    id: 'name',
    header: 'Шаблон',
    width: 'minmax(220px, 2fr)',
    cell: (template) => (
      <span className="block min-w-0">
        <span className="block truncate font-medium">{template.name}</span>
        {template.description && (
          <span className="block truncate text-[13px] text-subtle">{template.description}</span>
        )}
      </span>
    ),
  },
  {
    id: 'stages',
    header: 'Этапы',
    width: 'minmax(280px, 3fr)',
    cell: (template) => (
      <span className="line-clamp-2 text-[13px] text-muted">
        {template.stages.map((stage) => stage.name).join(' → ')}
      </span>
    ),
  },
  {
    id: 'orders',
    header: 'Заказы',
    width: '120px',
    cell: (template) => (
      <span className="tabular text-[13px] text-muted">
        {template.orderCount > 0
          ? `${template.orderCount} ${plural(template.orderCount, ['заказ', 'заказа', 'заказов'])}`
          : 'Нет'}
      </span>
    ),
  },
];

type View = 'active' | 'archived';

export function TemplatesPage() {
  const templates = useTemplates();
  const [view, setView] = useState<View>('active');
  const archivedCount = templates.data?.filter((template) => template.archived).length ?? 0;
  const rows =
    templates.data?.filter((template) => template.archived === (view === 'archived')) ?? [];

  return (
    <Page
      title="Шаблоны"
      description="Последовательности этапов, по которым идут заказы"
      actions={
        <>
          <Segmented
            label="Какие шаблоны показать"
            value={view}
            onChange={setView}
            segments={[
              { value: 'active', label: 'Активные' },
              { value: 'archived', label: 'Архив', count: archivedCount },
            ]}
          />
          <Link
            to="/templates/new"
            className={buttonClasses({ variant: 'primary', rounded: 'xl' })}
          >
            <Plus aria-hidden size={15} strokeWidth={1.75} />
            Добавить шаблон
          </Link>
        </>
      }
    >
      {templates.isPending && <Loading />}
      {templates.isError && (
        <LoadError error={templates.error} onRetry={() => void templates.refetch()} />
      )}
      {templates.data && rows.length === 0 && (
        <EmptyState title={view === 'archived' ? 'Архив пуст' : 'Шаблонов пока нет'} />
      )}
      {rows.length > 0 && (
        <Table
          label="Шаблоны"
          columns={COLUMNS}
          rows={rows}
          rowKey={(template) => template.id}
          rowHref={(template) => `/templates/${template.id}`}
        />
      )}
    </Page>
  );
}
