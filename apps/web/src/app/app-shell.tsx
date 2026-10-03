import type { Permission } from '@webmotiv/shared';
import {
  ClipboardList,
  Inbox,
  ListChecks,
  type LucideIcon,
  ScrollText,
  ShieldCheck,
  Users,
  Waypoints,
  Workflow,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { cx } from '../components/ui.tsx';
import { useCurrentUser } from './session.tsx';
import { UserMenu } from './user-menu.tsx';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Пункт виден, только если у сотрудника есть это право. */
  permission?: Permission;
}

const MAIN_NAV: NavItem[] = [
  { to: '/tasks', label: 'Мои задачи', icon: Inbox },
  { to: '/orders', label: 'Заказы', icon: ClipboardList },
];

const SETUP_NAV: NavItem[] = [
  { to: '/templates', label: 'Шаблоны', icon: Workflow, permission: 'templates.manage' },
  { to: '/stages', label: 'Этапы', icon: ListChecks, permission: 'templates.manage' },
  { to: '/users', label: 'Сотрудники', icon: Users, permission: 'users.manage' },
  { to: '/roles', label: 'Роли', icon: ShieldCheck, permission: 'roles.manage' },
  { to: '/audit', label: 'Журнал', icon: ScrollText, permission: 'audit.view' },
];

// Пункт лежит прямо на сером фоне; выбранный поднимается белой плашкой — как блоки контента.
const NAV_ITEM =
  'group flex h-9 items-center gap-2.5 rounded-lg border border-transparent px-2.5 text-sm ' +
  'transition-colors duration-100 max-md:justify-center max-md:px-0';

function SidebarLink({ to, label, icon: Icon }: NavItem) {
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) =>
        cx(
          NAV_ITEM,
          isActive
            ? 'border-line bg-surface font-medium text-fg shadow-card'
            : 'text-muted hover:bg-nav-hover hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            aria-hidden
            size={16}
            strokeWidth={1.75}
            className={cx(
              'shrink-0 transition-colors duration-100',
              isActive ? 'text-accent' : 'text-subtle group-hover:text-fg',
            )}
          />
          <span className="truncate max-md:sr-only">{label}</span>
        </>
      )}
    </NavLink>
  );
}

/**
 * Оболочка приложения: постоянный сайдбар на сером фоне и контент страницы справа.
 * На узком экране сайдбар сжимается до иконок.
 */
export function AppShell() {
  const me = useCurrentUser();
  const setup = SETUP_NAV.filter(
    (item) => !item.permission || me.permissions.includes(item.permission),
  );
  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col gap-5 px-3 py-3 max-md:w-16 max-md:px-2">
        <div className="flex h-9 items-center gap-2.5 px-1.5 max-md:justify-center max-md:px-0">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-accent-fg">
            <Waypoints aria-hidden size={16} strokeWidth={2} />
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.01em] max-md:sr-only">
            WebMotiv
          </span>
        </div>

        <nav aria-label="Разделы" className="flex flex-col gap-5">
          <div className="flex flex-col gap-0.5">
            {MAIN_NAV.map((item) => (
              <SidebarLink key={item.to} {...item} />
            ))}
          </div>
          {setup.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <h2 className="mb-1 px-2.5 text-xs font-medium text-subtle max-md:sr-only">
                Настройка
              </h2>
              {setup.map((item) => (
                <SidebarLink key={item.to} {...item} />
              ))}
            </div>
          )}
        </nav>

        <div className="mt-auto">
          <UserMenu />
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
