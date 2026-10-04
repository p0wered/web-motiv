import type { Permission } from '@webmotiv/shared';
import {
  ClipboardList,
  Inbox,
  ListChecks,
  type LucideIcon,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  ShieldCheck,
  Users,
  Workflow,
} from 'lucide-react';
import { useId } from 'react';
import { NavLink, Outlet } from 'react-router';
import { cx } from '../components/ui.tsx';
import { WebMotivMark } from '../components/webmotiv-mark.tsx';
import { useCurrentUser } from './session.tsx';
import { RAIL_FADE, useSidebar } from './sidebar.ts';
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
// Отступы подобраны так, чтобы в режиме иконок (w-16) иконка стояла ровно по центру
// и при сворачивании не сдвигалась.
const NAV_ITEM =
  'group flex h-9 items-center gap-2.5 rounded-xl border border-transparent px-3 text-sm ' +
  'transition-colors duration-100';

const TOGGLE_ICON = { 'aria-hidden': true, size: 16, strokeWidth: 1.75 } as const;

function SidebarLink({ to, label, icon: Icon }: NavItem) {
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) =>
        cx(
          NAV_ITEM,
          isActive
            ? 'border-line! bg-surface font-medium text-fg'
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
          <span className={cx('truncate', RAIL_FADE)}>{label}</span>
        </>
      )}
    </NavLink>
  );
}

/**
 * Оболочка приложения: сайдбар на сером фоне и контент страницы справа. Сайдбар сворачивается
 * до иконок кнопкой в шапке, на узком экране — всегда.
 */
export function AppShell() {
  const me = useCurrentUser();
  const { rail, canToggle, toggle } = useSidebar();
  const sidebarId = useId();
  const setup = SETUP_NAV.filter(
    (item) => !item.permission || me.permissions.includes(item.permission),
  );
  const toggleLabel = rail ? 'Развернуть меню' : 'Свернуть меню';

  return (
    <div className="flex h-full">
      <aside
        id={sidebarId}
        data-rail={rail || undefined}
        className="flex w-60 shrink-0 flex-col gap-5 p-3 rail:w-16 bg-sidebar [--subtle:var(--sidebar-subtle)]
        transition-[width] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
      >
        {/* Знак и название гаснут и сжимаются до нуля — кнопка уезжает вместе с краем сайдбара
            и в режиме иконок встаёт по их оси. На узком экране шапки нет: сворачивать нечего. */}
        {canToggle && (
          // pl-1.75: +1px рамки у пунктов меню — кнопка и текст на одной оси с иконками.
          <div className="flex h-9 items-center overflow-hidden pr-1.5 pl-1.75">
            {/* Отступ — у вложенного span: у самого flex-элемента он не сжался бы до нуля. */}
            <span className={cx('min-w-0 flex-1 overflow-hidden', RAIL_FADE)}>
              <span className="flex items-center gap-2 pl-1.5">
                <WebMotivMark className="size-6 shrink-0" />
                <span className="truncate text-base font-semibold tracking-[-0.01em]">WebMotiv</span>
              </span>
            </span>
            <button
              type="button"
              aria-label={toggleLabel}
              title={toggleLabel}
              aria-expanded={!rail}
              aria-controls={sidebarId}
              onClick={toggle}
              className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-subtle
              transition-colors duration-100 hover:bg-nav-hover hover:text-fg"
            >
              {rail ? <PanelLeftOpen {...TOGGLE_ICON} /> : <PanelLeftClose {...TOGGLE_ICON} />}
            </button>
          </div>
        )}

        <nav aria-label="Разделы" className="flex flex-col gap-5">
          <div className="flex flex-col gap-0.5">
            {MAIN_NAV.map((item) => (
              <SidebarLink key={item.to} {...item} />
            ))}
          </div>
          {setup.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {/* В режиме иконок заголовок гаснет, но держит место — иконки не прыгают. */}
              <h2 className={cx('mb-1 truncate px-3 text-xs font-medium text-subtle', RAIL_FADE)}>
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
