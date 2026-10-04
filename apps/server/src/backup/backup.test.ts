import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { openDb } from '../db/db.ts';
import { files, orders } from '../db/schema.ts';
import { seedDemo } from '../demo/seed-demo.ts';
import { dataPaths, ensureDataDirs } from '../paths.ts';
import { testHasher } from '../test-support/test-app.ts';
import { BackupError, createBackup, listBackups, restoreBackup } from './backup.ts';
import { msUntil } from './scheduler.ts';

async function seeded() {
  const paths = dataPaths(mkdtempSync(path.join(tmpdir(), 'webmotiv-backup-')));
  ensureDataDirs(paths);
  const db = openDb(paths.db);
  await seedDemo(db, testHasher(), paths);
  return { db, paths, dir: path.join(paths.dataDir, 'backups') };
}

const at = (time: string) => new Date(`2026-10-0${time}`);

describe('резервные копии', () => {
  it('копия: снимок БД и все файлы; хранятся только последние', async () => {
    const { db, paths, dir } = await seeded();
    const first = await createBackup(db, paths, { dir, keep: 2, now: at('5T03:00:00') });
    expect(path.basename(first.dir)).toBe('2026-10-05_030000');
    expect(first.files).toBe(db.select().from(files).all().length);
    expect(readdirSync(path.join(first.dir, 'files'))).toHaveLength(first.files);

    await createBackup(db, paths, { dir, keep: 2, now: at('6T03:00:00') });
    const third = await createBackup(db, paths, { dir, keep: 2, now: at('7T03:00:00') });
    expect(third.removed).toEqual(['2026-10-05_030000']);
    expect(await listBackups(dir)).toEqual(['2026-10-06_030000', '2026-10-07_030000']);
    await expect(
      createBackup(db, paths, { dir, keep: 2, now: at('7T03:00:00') }),
    ).rejects.toBeInstanceOf(BackupError);
  });

  it('восстановление: только при остановленном сервере, прежние данные — в сторону', async () => {
    const { db, paths, dir } = await seeded();
    await createBackup(db, paths, { dir, keep: 5, now: at('5T03:00:00') });
    const customer = db.select().from(orders).where(eq(orders.id, 1)).get()?.customer;
    db.update(orders).set({ customer: 'Испорчено' }).where(eq(orders.id, 1)).run();

    // БД открыта — рядом -wal/-shm: восстанавливать нельзя.
    await expect(restoreBackup(paths, dir, '2026-10-05_030000')).rejects.toThrow(/работает/);
    db.$client.close();
    await expect(restoreBackup(paths, dir, '../etc')).rejects.toBeInstanceOf(BackupError);

    const result = await restoreBackup(paths, dir, '2026-10-05_030000', {
      now: at('6T10:00:00'),
    });
    expect(existsSync(path.join(result.aside, 'app.sqlite'))).toBe(true);
    const restored = openDb(paths.db);
    expect(restored.select().from(orders).where(eq(orders.id, 1)).get()?.customer).toBe(customer);
    for (const file of restored.select().from(files).all()) {
      expect(existsSync(path.join(paths.filesDir, file.id))).toBe(true);
    }
    restored.$client.close();
  });

  it('расписание: ближайшее время сегодня или завтра', () => {
    const now = new Date('2026-10-04T02:30:00');
    expect(msUntil({ hours: 3, minutes: 0 }, now)).toBe(30 * 60_000);
    expect(msUntil({ hours: 2, minutes: 30 }, now)).toBe(24 * 3_600_000);
  });
});
