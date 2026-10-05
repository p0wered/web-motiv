import { type RefObject, useCallback, useLayoutEffect, useState } from 'react';
import { cx } from './ui.tsx';

type Placement = 'bottom' | 'top';
/** От какого края поля панель: `start` — растёт вправо, `end` — прижата справа и растёт влево. */
type Align = 'start' | 'end';

/** Отступ панели от края области контента. */
const EDGE = 8;

/**
 * Состояние выпадающей панели у поля формы. Панель всегда в DOM (скрыта через
 * visibility), поэтому её высоту можно измерить до открытия и развернуть её вверх,
 * если снизу не помещается, а закрытие анимируется так же, как открытие.
 *
 * Скрытая панель тоже занимает место: если она шире поля и вылезает за правый край, у области
 * контента появляется горизонтальная прокрутка. Поэтому такая панель прижимается к правому краю
 * поля — пересчёт при изменении ширины панели (пункты приходят с сервера) и области.
 */
export function usePopover(
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement>('bottom');
  const [align, setAlign] = useState<Align>('start');

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const area = anchor.closest('main') ?? document.documentElement;
    const measure = () => {
      const rect = anchor.getBoundingClientRect();
      const right = area.getBoundingClientRect().left + area.clientWidth - EDGE;
      const overflows = rect.left + panel.offsetWidth > right;
      // Влево — только если там есть место; иначе пусть лучше вылезает вправо.
      setAlign(overflows && rect.right - panel.offsetWidth >= EDGE ? 'end' : 'start');
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    observer.observe(area);
    return () => observer.disconnect();
  }, [anchorRef, panelRef]);

  const show = () => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    const height = panelRef.current?.offsetHeight ?? 0;
    if (anchor) {
      const below = window.innerHeight - anchor.bottom;
      setPlacement(below < height + 16 && anchor.top > below ? 'top' : 'bottom');
    }
    setOpen(true);
  };

  // Стабильная ссылка: hide удобно передавать в зависимости эффектов.
  const hide = useCallback(() => setOpen(false), []);

  return { open, placement, align, show, hide };
}

/** Карточка выпадающей панели над содержимым и её появление; положение задаёт вызывающий. */
export function popoverSurface(open: boolean): string {
  return cx(
    'absolute z-30 rounded-2xl bg-surface p-1.5 shadow-popover dark:ring-1 dark:ring-line',
    'duration-150 ease-out motion-reduce:transition-none',
    // Видимой панель становится сразу (в первом кадре перехода она ещё hidden, и в неё
    // нельзя перевести фокус), а скрывается — после того, как погаснет.
    open
      ? 'visible scale-100 opacity-100 transition-[opacity,scale]'
      : 'invisible scale-[0.97] opacity-0 transition-[opacity,scale,visibility]',
  );
}

/** Положение панели относительно поля: сверху или снизу, от левого или правого края. */
export function popoverPosition(placement: Placement, align: Align): string {
  return cx(
    align === 'end' ? 'right-0' : 'left-0',
    placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
    placement === 'top'
      ? align === 'end'
        ? 'origin-bottom-right'
        : 'origin-bottom-left'
      : align === 'end'
        ? 'origin-top-right'
        : 'origin-top-left',
  );
}

/** Классы панели у поля формы: появляется от края поля. */
export function popoverClasses(
  open: boolean,
  placement: Placement,
  align: Align,
  className?: string,
): string {
  return cx(popoverSurface(open), 'min-w-full', popoverPosition(placement, align), className);
}

/** Прокрутить список так, чтобы пункт был виден (или стоял по центру — при открытии). */
export function scrollIntoList(list: HTMLElement, item: HTMLElement, center = false) {
  const top = item.offsetTop;
  const bottom = top + item.offsetHeight;
  if (center) {
    list.scrollTop = top - (list.clientHeight - item.offsetHeight) / 2;
  } else if (top < list.scrollTop) {
    list.scrollTop = top - 4;
  } else if (bottom > list.scrollTop + list.clientHeight) {
    list.scrollTop = bottom - list.clientHeight + 4;
  }
}
