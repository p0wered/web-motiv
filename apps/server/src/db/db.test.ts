import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { openDb } from './db.ts';
import { roles, stages, users } from './schema.ts';

/** Код ошибки SQLite из запроса (Drizzle оборачивает её, исходная — в cause). */
function sqliteErrorCode(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause;
    return cause?.code;
  }
  return undefined;
}

describe('openDb', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'webmotiv-db-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('применяет миграции и включает внешние ключи', () => {
    const db = openDb(path.join(dir, 'app.sqlite'));
    expect(db.$client.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.$client.pragma('journal_mode', { simple: true })).toBe('wal');
    db.$client.close();
  });

  it('повторное открытие не ломает схему', () => {
    const file = path.join(dir, 'twice.sqlite');
    openDb(file).$client.close();
    const db = openDb(file);
    const now = new Date();
    db.insert(users)
      .values({ login: 'Admin', fullName: 'Администратор', passwordHash: 'x', createdAt: now })
      .run();
    // Логин уникален без учёта регистра.
    expect(
      sqliteErrorCode(() =>
        db
          .insert(users)
          .values({ login: 'admin', fullName: 'Другой', passwordHash: 'x', createdAt: now })
          .run(),
      ),
    ).toBe('SQLITE_CONSTRAINT_UNIQUE');
    db.$client.close();
  });

  it('этап с исполнителем «роль» требует роль', () => {
    const db = openDb(path.join(dir, 'check.sqlite'));
    const now = new Date();
    expect(
      sqliteErrorCode(() =>
        db
          .insert(stages)
          .values({ name: 'Счёт', executor: 'role', createdAt: now, updatedAt: now })
          .run(),
      ),
    ).toBe('SQLITE_CONSTRAINT_CHECK');
    const role = db
      .insert(roles)
      .values({ name: 'Бухгалтер', permissions: [], createdAt: now, updatedAt: now })
      .returning()
      .get();
    db.insert(stages)
      .values({
        name: 'Счёт',
        executor: 'role',
        executorRoleId: role.id,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    db.$client.close();
  });
});
