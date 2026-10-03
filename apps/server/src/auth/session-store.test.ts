import { describe, expect, it } from 'vitest';
import { openDb } from '../db/db.ts';
import { users } from '../db/schema.ts';
import { SessionStore } from './session-store.ts';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function setup() {
  const db = openDb(':memory:');
  const user = db
    .insert(users)
    .values({ login: 'ivanov', fullName: 'Иванов', passwordHash: 'x', createdAt: new Date() })
    .returning()
    .get();
  const store = new SessionStore(db, { idleMs: 2 * HOUR, absoluteMs: 12 * HOUR });
  return { db, store, userId: user.id };
}

describe('SessionStore', () => {
  it('в БД хранится не токен, а его хэш', () => {
    const { db, store, userId } = setup();
    const { token } = store.create(userId, { ip: null, userAgent: null });
    const stored = db.$client.prepare('SELECT id FROM sessions').pluck().get() as string;
    expect(stored).not.toBe(token);
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
  });

  it('истекает после бездействия', () => {
    const { store, userId } = setup();
    const start = new Date('2026-10-05T09:00:00Z');
    const { token } = store.create(userId, { ip: null, userAgent: null }, start);
    expect(store.authenticate(token, new Date(start.getTime() + 2 * HOUR - MINUTE))).not.toBeNull();
    // Последняя активность продлила сессию ещё на 2 часа.
    expect(
      store.authenticate(token, new Date(start.getTime() + 4 * HOUR - 2 * MINUTE)),
    ).not.toBeNull();
    expect(store.authenticate(token, new Date(start.getTime() + 6 * HOUR))).toBeNull();
  });

  it('истекает по абсолютному сроку даже при активности', () => {
    const { store, userId } = setup();
    const start = new Date('2026-10-05T09:00:00Z');
    const { token } = store.create(userId, { ip: null, userAgent: null }, start);
    for (let hour = 1; hour < 12; hour++) {
      expect(store.authenticate(token, new Date(start.getTime() + hour * HOUR))).not.toBeNull();
    }
    expect(store.authenticate(token, new Date(start.getTime() + 12 * HOUR))).toBeNull();
  });
});
