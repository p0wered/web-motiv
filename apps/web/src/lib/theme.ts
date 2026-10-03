import { useCallback, useEffect, useState } from 'react';
import { readStored, writeStored } from './storage.ts';

export type Theme = 'light' | 'dark';

/** Тот же ключ читает public/theme-init.js до первой отрисовки. */
const STORAGE_KEY = 'webmotiv.theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

function systemTheme(): Theme {
  return media().matches ? 'dark' : 'light';
}

function storedTheme(): Theme | null {
  const value = readStored(STORAGE_KEY);
  return value === 'light' || value === 'dark' ? value : null;
}

function apply(theme: Theme): void {
  const root = document.documentElement;
  if (root.classList.contains('dark') === (theme === 'dark')) return;
  // На время смены темы переходы выключены (.theme-switching в index.css): иначе кнопки и поля
  // плавно «догоняют» новую палитру. Кроме элементов с data-theme-animate — сам переключатель
  // темы должен анимироваться.
  root.classList.add('theme-switching');
  root.classList.toggle('dark', theme === 'dark');
  void root.offsetHeight; // применить стили до того, как вернуть переходы
  requestAnimationFrame(() => root.classList.remove('theme-switching'));
}

/** Тема: пока пользователь не выбрал сам — как в системе; выбор запоминается. */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() => storedTheme() ?? systemTheme());

  useEffect(() => apply(theme), [theme]);

  useEffect(() => {
    const query = media();
    const onChange = () => {
      if (!storedTheme()) setTheme(systemTheme());
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      // Совпал с системной — выбор можно не хранить: дальше тема снова следует системе.
      writeStored(STORAGE_KEY, next === systemTheme() ? null : next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
