// Сортировка перетаскиванием (dnd-kit): мышью — за ручку, с клавиатуры — пробел на ручке,
// стрелки, пробел ещё раз (Esc — отмена).
import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  type Modifier,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './ui.tsx';

/** Только по вертикали: список не уезжает вбок за курсором. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

const ANNOUNCEMENTS = {
  onDragStart: () => 'Элемент взят. Стрелки — переместить, пробел — оставить здесь, Esc — отмена.',
  onDragOver: () => '',
  onDragEnd: () => 'Элемент перемещён.',
  onDragCancel: () => 'Перемещение отменено.',
};

/** Свойства ручки перетаскивания: обработчики dnd-kit, ARIA и колбэк-реф. */
export interface DragHandle {
  props: HTMLAttributes<HTMLButtonElement> & { ref: (element: HTMLElement | null) => void };
}

interface SortableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  onReorder: (items: T[]) => void;
  disabled?: boolean;
  /** Каждый элемент — `<li>`: сюда — его содержимое, `handle` — для ручки перетаскивания. */
  children: (item: T, index: number, handle: DragHandle) => ReactNode;
  itemClassName?: (dragging: boolean, index: number) => string;
  className?: string;
}

export function SortableList<T>({
  items,
  getId,
  onReorder,
  disabled = false,
  children,
  itemClassName,
  className,
}: SortableListProps<T>) {
  const sensors = useSensors(
    // Небольшой порог: клик по ручке не начинает перетаскивание.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map(getId);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) onReorder(arrayMove(items, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      // closestCorners, а не closestCenter: у элементов разной высоты (раскрытое поле) центр
      // большого остаётся ближе к своему месту, и сдвиг на одну позицию не срабатывал.
      collisionDetection={closestCorners}
      modifiers={[verticalOnly]}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements: ANNOUNCEMENTS,
        screenReaderInstructions: {
          draggable: 'Чтобы переместить, нажмите пробел, затем стрелки вверх и вниз.',
        },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={disabled}>
        <ul className={className}>
          {items.map((item, index) => (
            <SortableItem
              key={getId(item)}
              id={getId(item)}
              className={(dragging) => itemClassName?.(dragging, index) ?? ''}
            >
              {(handle) => children(item, index, handle)}
            </SortableItem>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({
  id,
  className,
  children,
}: {
  id: string;
  className: (dragging: boolean) => string;
  children: (handle: DragHandle) => ReactNode;
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cx('relative', isDragging && 'z-10', className(isDragging))}
    >
      {children({ props: { ...attributes, ...listeners, ref: setActivatorNodeRef } })}
    </li>
  );
}

/** Ручка перетаскивания — кнопка, чтобы до неё можно было дойти с клавиатуры. */
export function GripHandle({ handle, label }: { handle: DragHandle; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title="Перетащите, чтобы изменить порядок"
      {...handle.props}
      className="grid h-9 w-6 shrink-0 cursor-grab touch-none place-items-center rounded-md text-subtle transition-colors hover:bg-row-hover hover:text-fg active:cursor-grabbing disabled:cursor-default"
    >
      <GripVertical aria-hidden size={15} strokeWidth={1.75} />
    </button>
  );
}
