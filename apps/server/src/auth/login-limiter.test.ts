import { describe, expect, it } from 'vitest';
import { LoginLimiter } from './login-limiter.ts';

const options = {
  freeAttempts: { login: 3, ip: 10 },
  baseDelayMs: 30_000,
  maxDelayMs: 15 * 60_000,
  forgetAfterMs: 60 * 60_000,
  maxEntries: 100,
};

describe('LoginLimiter', () => {
  const key = [{ kind: 'login' as const, value: 'Ivanov' }];

  it('пауза нарастает и упирается в максимум', () => {
    const limiter = new LoginLimiter(options);
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) limiter.recordFailure(key, now);
    expect(limiter.retryAfterSeconds(key, now)).toBe(0);
    limiter.recordFailure(key, now);
    expect(limiter.retryAfterSeconds(key, now)).toBe(30);
    limiter.recordFailure(key, now);
    expect(limiter.retryAfterSeconds(key, now)).toBe(60);
    for (let i = 0; i < 10; i++) limiter.recordFailure(key, now);
    expect(limiter.retryAfterSeconds(key, now)).toBe(15 * 60);
  });

  it('логин без учёта регистра; после паузы снова можно', () => {
    const limiter = new LoginLimiter(options);
    for (let i = 0; i < 4; i++) limiter.recordFailure(key, 0);
    expect(limiter.retryAfterSeconds([{ kind: 'login', value: 'IVANOV' }], 0)).toBe(30);
    expect(limiter.retryAfterSeconds(key, 30_000)).toBe(0);
  });

  it('забывает старые ошибки и не растёт без предела', () => {
    const limiter = new LoginLimiter(options);
    for (let i = 0; i < 500; i++) limiter.recordFailure([{ kind: 'login', value: `u${i}` }], i);
    expect(limiter.size).toBeLessThanOrEqual(100);
    limiter.recordFailure(key, 10 * 60 * 60_000);
    expect(limiter.size).toBe(1);
  });
});
