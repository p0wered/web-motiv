// Ограничение попыток входа (PLAN.md §7.1): по IP и по логину, с нарастающей паузой вместо
// вечной блокировки — иначе злоумышленник мог бы заблокировать чужую учётку. Хранится в памяти:
// сервер один, а после перезапуска начать заново — нормально.

export interface LimiterOptions {
  /** Сколько неудачных попыток подряд проходит без паузы — для логина и для IP. */
  freeAttempts: { login: number; ip: number };
  /** Пауза после первой попытки сверх бесплатных; дальше удваивается. */
  baseDelayMs: number;
  maxDelayMs: number;
  /** Через сколько после последней ошибки счётчик забывается. */
  forgetAfterMs: number;
  /** Предел записей в памяти: перебор случайных логинов не должен её съесть. */
  maxEntries: number;
}

export const DEFAULT_LIMITER_OPTIONS: LimiterOptions = {
  // Весь офис может выходить в интернет с одного IP — ему нужен запас побольше.
  freeAttempts: { login: 5, ip: 20 },
  baseDelayMs: 30_000,
  maxDelayMs: 15 * 60_000,
  forgetAfterMs: 60 * 60_000,
  maxEntries: 10_000,
};

interface Entry {
  failures: number;
  lastFailureAt: number;
  blockedUntil: number;
}

export interface LimiterKey {
  kind: 'login' | 'ip';
  value: string;
}

export class LoginLimiter {
  private readonly entries = new Map<string, Entry>();
  private readonly options: LimiterOptions;

  constructor(options: LimiterOptions = DEFAULT_LIMITER_OPTIONS) {
    this.options = options;
  }

  /** Сколько секунд ждать до следующей попытки; 0 — можно сейчас. */
  retryAfterSeconds(keys: LimiterKey[], now = Date.now()): number {
    let until = 0;
    for (const key of keys) {
      const entry = this.current(key, now);
      if (entry) until = Math.max(until, entry.blockedUntil);
    }
    return until > now ? Math.ceil((until - now) / 1000) : 0;
  }

  recordFailure(keys: LimiterKey[], now = Date.now()): void {
    for (const key of keys) {
      const id = this.id(key);
      const entry = this.current(key, now) ?? { failures: 0, lastFailureAt: now, blockedUntil: 0 };
      entry.failures++;
      entry.lastFailureAt = now;
      const over = entry.failures - this.options.freeAttempts[key.kind];
      if (over > 0) {
        const delay = Math.min(this.options.baseDelayMs * 2 ** (over - 1), this.options.maxDelayMs);
        entry.blockedUntil = now + delay;
      }
      // Свежая запись — в конец: Map упорядочена по последней ошибке.
      this.entries.delete(id);
      this.entries.set(id, entry);
    }
    this.prune(now);
  }

  reset(keys: LimiterKey[]): void {
    for (const key of keys) this.entries.delete(this.id(key));
  }

  /** Сколько ключей сейчас учитывается (для тестов). */
  get size(): number {
    return this.entries.size;
  }

  private id(key: LimiterKey): string {
    return `${key.kind}:${key.kind === 'login' ? key.value.toLowerCase() : key.value}`;
  }

  private current(key: LimiterKey, now: number): Entry | undefined {
    const id = this.id(key);
    const entry = this.entries.get(id);
    if (entry && this.expired(entry, now)) {
      this.entries.delete(id);
      return undefined;
    }
    return entry;
  }

  private expired(entry: Entry, now: number): boolean {
    return entry.blockedUntil <= now && now - entry.lastFailureAt >= this.options.forgetAfterMs;
  }

  private prune(now: number): void {
    for (const [id, entry] of this.entries) {
      if (this.entries.size <= this.options.maxEntries && !this.expired(entry, now)) break;
      this.entries.delete(id);
    }
  }
}
