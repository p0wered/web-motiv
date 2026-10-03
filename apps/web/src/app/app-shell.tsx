import {
  ClipboardList,
  Inbox,
  ListChecks,
  type LucideIcon,
  Moon,
  ScrollText,
  ShieldCheck,
  Users,
  Waypoints,
  Workflow,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { cx } from '../components/ui.tsx';
import { useTheme } from '../lib/theme.ts';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const MAIN_NAV: NavItem[] = [
  { to: '/tasks', label: 'Мои задачи', icon: Inbox },
  { to: '/orders', label: 'Заказы', icon: ClipboardList },
];

const SETUP_NAV: NavItem[] = [
  { to: '/templates', label: 'Шаблоны', icon: Workflow },
  { to: '/stages', label: 'Этапы', icon: ListChecks },
  { to: '/users', label: 'Сотрудники', icon: Users },
  { to: '/roles', label: 'Роли', icon: ShieldCheck },
  { to: '/audit', label: 'Журнал', icon: ScrollText },
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

function ThemeSwitch() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      title="Тёмная тема"
      onClick={toggle}
      className={cx(NAV_ITEM, 'w-full cursor-pointer text-muted hover:bg-nav-hover hover:text-fg')}
    >
      <Moon aria-hidden size={16} strokeWidth={1.75} className="shrink-0 text-subtle" />
      <span className="truncate max-md:sr-only">Тёмная тема</span>
      <span
        aria-hidden
        data-theme-animate
        className={cx(
          'ml-auto flex h-4 w-7 items-center rounded-full p-0.5 transition-colors duration-200 max-md:hidden motion-reduce:transition-none',
          dark ? 'bg-accent' : 'bg-line-strong',
        )}
      >
        <span
          data-theme-animate
          className={cx(
            'size-3 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.34,1.4,0.64,1)] motion-reduce:transition-none',
            dark && 'translate-x-3',
          )}
        />
      </span>
    </button>
  );
}

/**
 * Оболочка приложения: постоянный сайдбар на сером фоне и контент страницы справа.
 * На узком экране сайдбар сжимается до иконок.
 */
export function AppShell() {
  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col gap-5 px-3 py-3 max-md:w-15 max-md:px-2">
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
          <div className="flex flex-col gap-0.5">
            <h2 className="mb-1 px-2.5 text-xs font-medium text-subtle max-md:sr-only">
              Настройка
            </h2>
            {SETUP_NAV.map((item) => (
              <SidebarLink key={item.to} {...item} />
            ))}
          </div>
        </nav>

        <div className="mt-auto">
          <ThemeSwitch />
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
