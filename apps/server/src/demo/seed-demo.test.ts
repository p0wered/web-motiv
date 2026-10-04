import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { asc } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { openDb } from '../db/db.ts';
import { events, files, orders, users } from '../db/schema.ts';
import { dataPaths, ensureDataDirs } from '../paths.ts';
import { testHasher } from '../test-support/test-app.ts';
import { seedDemo, SeedError } from './seed-demo.ts';

function emptyData() {
  const paths = dataPaths(mkdtempSync(path.join(tmpdir(), 'webmotiv-seed-')));
  ensureDataDirs(paths);
  return { db: openDb(paths.db), paths };
}

describe('seed-demo', () => {
  it('заполняет пустую базу: сотрудники, заказы на разных этапах, файлы, история по порядку', async () => {
    const { db, paths } = emptyData();
    const now = new Date('2026-10-07T15:00:00');
    const result = await seedDemo(db, testHasher(), paths, now);

    expect(result.users.map((user) => user.login)).toEqual([
      'admin',
      'manager',
      'manager2',
      'buh',
      'zakup',
      'sklad',
    ]);
    expect(db.select().from(users).all()).toHaveLength(6);

    const statuses = db.select({ status: orders.status }).from(orders).all();
    expect(statuses).toHaveLength(result.orders);
    expect(statuses.filter((row) => row.status === 'completed')).toHaveLength(2);
    expect(statuses.filter((row) => row.status === 'cancelled')).toHaveLength(1);

    // Каждый файл на диске и совпадает с записью.
    const fileRows = db.select().from(files).all();
    expect(fileRows.length).toBeGreaterThan(10);
    for (const file of fileRows) {
      const content = readFileSync(path.join(paths.filesDir, file.id));
      expect(createHash('sha256').update(content).digest('hex')).toBe(file.sha256);
    }

    // Журнал — по порядку времени и весь в прошлом, в рабочие часы.
    const times = db
      .select({ at: events.at })
      .from(events)
      .orderBy(asc(events.id))
      .all()
      .map((row) => row.at.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(Math.max(...times)).toBeLessThan(now.getTime());
    const orderTimes = db.select({ at: orders.createdAt }).from(orders).all();
    for (const { at } of orderTimes) {
      expect(at.getHours()).toBeGreaterThanOrEqual(9);
      expect(at.getHours()).toBeLessThan(18);
      expect([0, 6]).not.toContain(at.getDay());
    }
  });

  it('не трогает базу, где уже есть сотрудники', async () => {
    const { db, paths } = emptyData();
    await seedDemo(db, testHasher(), paths);
    await expect(seedDemo(db, testHasher(), paths)).rejects.toBeInstanceOf(SeedError);
  });
});
