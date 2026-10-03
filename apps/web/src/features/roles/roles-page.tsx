import { plural, type Role } from '@webmotiv/shared';
import { Plus } from 'lucide-react';
import { Link } from 'react-router';
import { useRoles } from '../../api/roles.ts';
import { buttonClasses } from '../../components/button.tsx';
import { Page } from '../../components/page.tsx';
import { LoadError, Loading } from '../../components/status.tsx';
import { type Column, Table } from '../../components/table.tsx';
import { permissionsSummary } from './permission-text.ts';

const COLUMNS: Column<Role>[] = [
  {
    id: 'name',
    header: 'Роль',
    width: 'minmax(180px, 1fr)',
    cell: (role) => <span className="font-medium">{role.name}</span>,
  },
  {
    id: 'permissions',
    header: 'Права',
    width: 'minmax(260px, 3fr)',
    cell: (role) => (
      <span className="line-clamp-2 text-[13px] text-muted">
        {permissionsSummary(role.permissions)}
      </span>
    ),
  },
  {
    id: 'users',
    header: 'Сотрудники',
    width: '140px',
    cell: (role) => (
      <span className="tabular text-[13px] text-muted">
        {role.userCount > 0
          ? `${role.userCount} ${plural(role.userCount, ['сотрудник', 'сотрудника', 'сотрудников'])}`
          : 'Нет'}
      </span>
    ),
  },
];

export function RolesPage() {
  const roles = useRoles();
  return (
    <Page
      title="Роли"
      description="Должности и их права. Роль — ещё и исполнитель этапов заказа"
      actions={
        <Link to="/roles/new" className={buttonClasses({ variant: 'primary' })}>
          <Plus aria-hidden size={15} strokeWidth={1.75} />
          Добавить роль
        </Link>
      }
    >
      {roles.isPending && <Loading />}
      {roles.isError && <LoadError error={roles.error} onRetry={() => void roles.refetch()} />}
      {roles.data && (
        <Table
          label="Роли"
          columns={COLUMNS}
          rows={roles.data}
          rowKey={(role) => role.id}
          rowHref={(role) => `/roles/${role.id}`}
        />
      )}
    </Page>
  );
}
