import { useCallback, useState, useSyncExternalStore } from 'react';
import { readStored, writeStored } from '../lib/storage.ts';

const STORAGE_KEY = 'webmotiv.sidebar';
/** То же, что max-md в Tailwind: на узком экране сайдбар всегда сжат до иконок. */
const NARROW = '(width < 48rem)';

function subscribeNarrow(onChange: () => void) {
  const query = window.matchMedia(NARROW);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const isNarrow = () => window.matchMedia(NARROW).matches;

/**
 * Подписи сайдбара в режиме иконок (вариант rail: в index.css). Гаснут быстро, пока сайдбар
 * сужается; при раскрытии проявляются чуть позже — когда для них уже есть место.
 */
export const RAIL_FADE =
  'transition-opacity duration-150 delay-75 rail:opacity-0 rail:delay-0 rail:duration-100 ' +
  'motion-reduce:transition-none';

/** Свёрнут ли сайдбар: выбор пользователя запоминается, узкий экран сворачивает его всегда. */
export function useSidebar(): {
  /** Сайдбар показан иконками — свёрнут вручную или экран узкий. */
  rail: boolean;
  /** Свернуть/развернуть можно только на широком экране. */
  canToggle: boolean;
  toggle: () => void;
} {
  const [collapsed, setCollapsed] = useState(() => readStored(STORAGE_KEY) === 'collapsed');
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow);

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      writeStored(STORAGE_KEY, current ? null : 'collapsed');
      return !current;
    });
  }, []);

  return { rail: collapsed || narrow, canToggle: !narrow, toggle };
}
