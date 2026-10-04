const dateTime = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const dateTimeWithYear = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** «сегодня в 10:15», «вчера в 18:02», «3 окт., 09:00», с годом — если не текущий. */
export function formatDateTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const days = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000);
  if (days === 0) return `сегодня в ${time.format(date)}`;
  if (days === 1) return `вчера в ${time.format(date)}`;
  return (date.getFullYear() === now.getFullYear() ? dateTime : dateTimeWithYear).format(date);
}

/** «Chrome, Windows» из User-Agent — чтобы сотрудник узнал свой сеанс. */
export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'Неизвестное устройство';
  const browser = /YaBrowser/.test(userAgent)
    ? 'Яндекс Браузер'
    : /Edg\//.test(userAgent)
      ? 'Edge'
      : /OPR\//.test(userAgent)
        ? 'Opera'
        : /Firefox\//.test(userAgent)
          ? 'Firefox'
          : /Chrome\//.test(userAgent)
            ? 'Chrome'
            : /Safari\//.test(userAgent)
              ? 'Safari'
              : null;
  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /iPhone|iPad/.test(userAgent)
      ? 'iOS'
      : /Mac OS X/.test(userAgent)
        ? 'macOS'
        : /Android/.test(userAgent)
          ? 'Android'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null;
  return [browser, os].filter(Boolean).join(', ') || 'Неизвестное устройство';
}

/** Инициалы для аватара: «Иванов Иван» → «ИИ». */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0])
      .join('') || '?'
  ).toUpperCase();
}

const dateOnly = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** «2026-10-04» → «4 октября 2026 г.». */
export function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return dateOnly.format(new Date(year, month - 1, day));
}

const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 6 });

export function formatNumber(value: number): string {
  return number.format(value);
}

/** «1,2 МБ», «340 КБ». */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  const units = ['КБ', 'МБ', 'ГБ'];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toLocaleString('ru-RU', { maximumFractionDigits: size < 10 ? 1 : 0 })} ${units[unit]}`;
}
