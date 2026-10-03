import type { LucideIcon } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from 'react';
import { buttonClasses } from './button.tsx';
import { popoverSurface, usePopover } from './popover.tsx';
import { cx } from './ui.tsx';

export interface MenuItem {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  onSelect: () => void;
}

interface MenuButtonProps {
  label: ReactNode;
  icon?: LucideIcon;
  items: MenuItem[];
  /** Подпись меню для чтения с экрана. */
  menuLabel: string;
  variant?: 'secondary' | 'ghost';
}

/** Кнопка с выпадающим меню (WAI-ARIA «menu button»): стрелки, Home/End, Esc. */
export function MenuButton({
  label,
  icon: Icon,
  items,
  menuLabel,
  variant = 'secondary',
}: MenuButtonProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Снизу не помещается — меню открывается вверх (как выпадающие списки полей).
  const { open, placement, show, hide: close } = usePopover(triggerRef, menuRef);
  const menuId = useId();

  const hide = (returnFocus = false) => {
    close();
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    const menu = menuRef.current;
    if (!open || !menu) return;
    menu.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointerDown = (event: Event) => {
      const target = event.target as Node;
      if (!menu.contains(target) && !triggerRef.current?.contains(target)) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const elements = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const index = elements.indexOf(document.activeElement as HTMLElement);
    const focus = (to: number) => {
      event.preventDefault();
      elements[(to + elements.length) % elements.length]?.focus();
    };
    switch (event.key) {
      case 'ArrowDown':
        return focus(index + 1);
      case 'ArrowUp':
        return focus(index - 1);
      case 'Home':
        return focus(0);
      case 'End':
        return focus(elements.length - 1);
      case 'Escape':
        event.preventDefault();
        return hide(true);
      case 'Tab':
        return hide();
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
        onClick={() => (open ? hide() : show())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            show();
          }
        }}
        className={buttonClasses({
          variant,
          className: 'aria-expanded:border-accent/60 aria-expanded:bg-accent/12',
        })}
      >
        {Icon && <Icon aria-hidden size={15} strokeWidth={1.75} />}
        {label}
      </button>
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        aria-label={menuLabel}
        inert={!open}
        onKeyDown={onMenuKeyDown}
        className={cx(
          popoverSurface(open),
          'left-0 w-72',
          placement === 'top'
            ? 'bottom-full mb-1.5 origin-bottom-left'
            : 'top-full mt-1.5 origin-top-left',
        )}
      >
        {items.map(({ id, label: itemLabel, description, icon: ItemIcon, onSelect }) => (
          <button
            key={id}
            type="button"
            role="menuitem"
            tabIndex={-1}
            onPointerMove={(event) => {
              if (document.activeElement !== event.currentTarget) event.currentTarget.focus();
            }}
            onClick={() => {
              hide(true);
              onSelect();
            }}
            className="group flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none transition-colors duration-100 hover:bg-row-hover focus-visible:bg-row-hover"
          >
            {ItemIcon && (
              <ItemIcon
                aria-hidden
                size={15}
                strokeWidth={1.75}
                className="mt-0.5 shrink-0 text-subtle transition-colors group-hover:text-accent group-focus-visible:text-accent"
              />
            )}
            <span className="min-w-0">
              <span className="block text-sm text-fg">{itemLabel}</span>
              {description && <span className="block text-xs text-subtle">{description}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
