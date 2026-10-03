import { LogOut, Moon, UserRound } from 'lucide-react';
import { type KeyboardEvent, type PointerEvent, useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useLogout } from '../api/auth.ts';
import { popoverSurface } from '../components/popover.tsx';
import { cx } from '../components/ui.tsx';
import { initials } from '../lib/format.ts';
import { useTheme } from '../lib/theme.ts';
import { useCurrentUser } from './session.tsx';
import { RAIL_FADE } from './sidebar.ts';

const MENU_ITEM =
  'group flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm text-fg ' +
  'transition-colors duration-100 outline-none hover:bg-row-hover focus-visible:bg-row-hover';

const MENU_ICON =
  'text-subtle transition-colors duration-100 group-hover:text-accent group-focus-visible:text-accent';

const menuItems = (menu: HTMLElement) => [
  ...menu.querySelectorAll<HTMLElement>('[role="menuitem"],[role="menuitemcheckbox"]'),
];

/** Пункт под мышью получает фокус, чтобы стрелки продолжали с него. */
function focusItem(event: PointerEvent<HTMLElement>) {
  if (document.activeElement !== event.currentTarget) event.currentTarget.focus();
}

/**
 * Сотрудник внизу сайдбара; по нажатию — меню (шаблон WAI-ARIA «menu button»): профиль,
 * тема, выход. Меню открывается вверх.
 */
export function UserMenu() {
  const me = useCurrentUser();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef<'first' | 'last'>('last');
  const { theme, toggle } = useTheme();
  const logout = useLogout();
  const navigate = useNavigate();
  const menuId = useId();

  const show = (focus: 'first' | 'last') => {
    focusOnOpen.current = focus;
    setOpen(true);
  };

  const hide = (returnFocus = false) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    const menu = menuRef.current;
    if (!open || !menu) return;
    const items = menuItems(menu);
    (focusOnOpen.current === 'first' ? items[0] : items.at(-1))?.focus();
    const onPointerDown = (event: Event) => {
      const target = event.target as Node;
      if (!menu.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      show(event.key === 'ArrowDown' ? 'first' : 'last');
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = menuItems(event.currentTarget);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focus = (to: number) => {
      event.preventDefault();
      items[(to + items.length) % items.length]?.focus();
    };
    switch (event.key) {
      case 'ArrowDown':
        return focus(index + 1);
      case 'ArrowUp':
        return focus(index - 1);
      case 'Home':
        return focus(0);
      case 'End':
        return focus(items.length - 1);
      case 'Escape':
        event.preventDefault();
        return hide(true);
      case 'Tab':
        return hide();
      case ' ':
        if (event.target instanceof HTMLAnchorElement) {
          event.preventDefault();
          event.target.click();
        }
    }
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={me.fullName}
        onClick={() => (open ? hide() : show('last'))}
        onKeyDown={onTriggerKeyDown}
        className={cx(
          // px-1: в режиме иконок аватар стоит по той же оси, что иконки разделов.
          'flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg border border-transparent px-1 text-left',
          'transition-colors duration-100 hover:bg-nav-hover aria-expanded:bg-nav-hover',
        )}
      >
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full
          bg-sunken text-xs font-semibold text-accent-text border border-line"
        >
          {initials(me.fullName)}
        </span>
        <span className={cx('min-w-0', RAIL_FADE)}>
          <span className="block truncate text-sm font-medium text-fg">{me.fullName}</span>
          <span className="block truncate text-xs text-subtle">
            {me.roles.map((role) => role.name).join(', ') || 'Без роли'}
          </span>
        </span>
      </button>

      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        aria-label="Меню сотрудника"
        inert={!open}
        onKeyDown={onMenuKeyDown}
        className={cx(popoverSurface(open), 'bottom-full left-0 mb-1.5 w-56 origin-bottom-left')}
      >
        <Link
          to="/profile"
          role="menuitem"
          tabIndex={-1}
          className={MENU_ITEM}
          onPointerMove={focusItem}
          onClick={() => hide()}
        >
          <UserRound aria-hidden size={15} strokeWidth={1.75} className={MENU_ICON} />
          Профиль
        </Link>
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={theme === 'dark'}
          tabIndex={-1}
          className={MENU_ITEM}
          onPointerMove={focusItem}
          // Меню остаётся открытым: новую тему видно сразу, её можно вернуть обратно.
          onClick={toggle}
        >
          <Moon aria-hidden size={15} strokeWidth={1.75} className={MENU_ICON} />
          Тёмная тема
          <span
            aria-hidden
            data-theme-animate
            className={cx(
              'ml-auto flex h-4 w-7 items-center rounded-full p-0.5 transition-colors duration-200 motion-reduce:transition-none',
              theme === 'dark' ? 'bg-accent' : 'bg-line-strong',
            )}
          >
            <span
              data-theme-animate
              className={cx(
                'size-3 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.34,1.4,0.64,1)] motion-reduce:transition-none',
                theme === 'dark' && 'translate-x-3',
              )}
            />
          </span>
        </button>
        <div role="separator" className="mx-1 my-1 h-px bg-line" />
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          disabled={logout.isPending}
          className={cx(
            MENU_ITEM,
            'hover:bg-danger-soft hover:text-danger focus-visible:bg-danger-soft focus-visible:text-danger disabled:opacity-50',
          )}
          onPointerMove={focusItem}
          onClick={() => {
            hide();
            logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) });
          }}
        >
          <LogOut
            aria-hidden
            size={15}
            strokeWidth={1.75}
            className="text-subtle transition-colors duration-100 group-hover:text-danger group-focus-visible:text-danger"
          />
          Выйти
        </button>
      </div>
    </div>
  );
}
