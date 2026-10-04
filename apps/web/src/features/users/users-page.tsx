import type { User } from '@webmotiv/shared';
import { UserPlus } from 'lucide-react';
import { Link } from 'react-router';
import { useUsers } from '../../api/users.ts';
import { Badge } from '../../components/badge.tsx';
import { buttonClasses } from '../../components/button.tsx';
import { Page } from '../../components/page.tsx';
import { LoadError, Loading } from '../../components/status.tsx';
import { type Column, Table } from '../../components/table.tsx';
import { formatDateTime, initials } from '../../lib/format.ts';
import { UserStatus } from './user-status.tsx';

const COLUMNS: Column<User>[] = [
  {
    id: 'name',
    header: 'Сотрудник',
    width: 'minmax(220px, 2fr)',
    cell: (user) => (
      <span className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full bg-sunken text-xs font-semibold text-muted"
        >
          {initials(user.fullName)}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{user.fullName}</span>
          <span className="block truncate text-[13px] text-subtle">{user.login}</span>
        </span>
      </span>
    ),
  },
  {
    id: 'roles',
    header: 'Роли',
    width: 'minmax(180px, 2fr)',
    cell: (user) =>
      user.roles.length > 0 ? (
        <span className="flex flex-wrap gap-1.5">
          {user.roles.map((role) => (
            <Badge key={role.id}>{role.name}</Badge>
          ))}
        </span>
      ) : (
        <span className="text-[13px] text-subtle">Без роли</span>
      ),
  },
  {
    id: 'status',
    header: 'Учётная запись',
    width: '160px',
    cell: (user) => <UserStatus user={user} />,
  },
  {
    id: 'lastLogin',
    header: 'Последний вход',
    width: '160px',
    cell: (user) => (
      <span className="text-[13px] text-muted">
        {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Входов не было'}
      </span>
    ),
  },
];

export function UsersPage() {
  const users = useUsers();
  return (
    <Page
      title="Сотрудники"
      description="Учётные записи, роли и доступ"
      actions={
        <Link to="/users/new" className={buttonClasses({ variant: 'primary', rounded: 'xl' })}>
          <UserPlus aria-hidden size={15} strokeWidth={1.75} />
          Добавить сотрудника
        </Link>
      }
    >
      {users.isPending && <Loading />}
      {users.isError && <LoadError error={users.error} onRetry={() => void users.refetch()} />}
      {users.data && (
        <Table
          label="Сотрудники"
          columns={COLUMNS}
          rows={users.data}
          rowKey={(user) => user.id}
          rowHref={(user) => `/users/${user.id}`}
        />
      )}
    </Page>
  );
}
