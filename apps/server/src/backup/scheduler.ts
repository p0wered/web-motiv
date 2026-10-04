// Ночная копия: раз в сутки в заданное местное время (BACKUP_TIME, часовой пояс — TZ).

/** Через сколько миллисекунд наступит ближайшее `hours:minutes`. */
export function msUntil(time: { hours: number; minutes: number }, now = new Date()): number {
  const next = new Date(now);
  next.setHours(time.hours, time.minutes, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

/** Запускает `run` каждый день в `time`; возвращает функцию остановки. */
export function scheduleDaily(
  time: { hours: number; minutes: number },
  run: () => Promise<void>,
): () => void {
  let timer: NodeJS.Timeout | null = null;
  let stopped = false;
  const plan = () => {
    timer = setTimeout(() => {
      void run().finally(() => {
        if (!stopped) plan();
      });
    }, msUntil(time));
    timer.unref();
  };
  plan();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
