// Резервные копии (PLAN.md §7.6): согласованный снимок БД и файлов в каталог с датой,
// проверка снимка, хранение N последних. Восстановление — README, раздел «Бэкапы».
import { existsSync } from 'node:fs';
import { chmod, copyFile, link, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { AppDb } from '../db/db.ts';
import type { DataPaths } from '../paths.ts';

/** Каталог копии: `2026-10-04_030000` (местное время). */
const BACKUP_NAME = /^\d{4}-\d{2}-\d{2}_\d{6}$/;
const PARTIAL = '.partial';

export interface BackupOptions {
  dir: string;
  /** Сколько последних копий хранить. */
  keep: number;
  now?: Date;
}

export interface BackupResult {
  dir: string;
  files: number;
  bytes: number;
  /** Удалённые по сроку копии. */
  removed: string[];
}

export class BackupError extends Error {}

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

export function backupName(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

export async function createBackup(
  db: AppDb,
  paths: DataPaths,
  options: BackupOptions,
): Promise<BackupResult> {
  const name = backupName(options.now ?? new Date());
  const target = path.join(options.dir, name);
  const partial = path.join(options.dir, `${name}${PARTIAL}`);
  if (await exists(target)) throw new BackupError(`Копия ${name} уже есть.`);
  await rm(partial, { recursive: true, force: true });
  await mkdir(path.join(partial, 'files'), { recursive: true, mode: 0o700 });

  try {
    // VACUUM INTO — снимок в одной транзакции чтения: согласован, даже пока идёт запись.
    // Сначала БД, потом файлы: файл появляется на диске раньше записи о нём в БД.
    db.$client.prepare('VACUUM INTO ?').run(path.join(partial, 'app.sqlite'));
    await chmod(path.join(partial, 'app.sqlite'), 0o600);

    const { count, bytes } = await linkFiles(paths.filesDir, path.join(partial, 'files'));

    verifyBackup(partial);
    await rename(partial, target);
    const removed = await prune(options.dir, options.keep);
    return { dir: target, files: count, bytes, removed };
  } catch (error) {
    await rm(partial, { recursive: true, force: true });
    throw error;
  }
}

/**
 * Восстановление из копии `name`. Сервер должен быть остановлен. Текущие данные не удаляются,
 * а переносятся в `before-restore-<время>` рядом — вернуть их можно так же, переносом.
 */
export async function restoreBackup(
  paths: DataPaths,
  backupDir: string,
  name: string,
  options: { force?: boolean; now?: Date } = {},
): Promise<{ aside: string; files: number }> {
  if (!BACKUP_NAME.test(name)) throw new BackupError(`Нет копии «${name}».`);
  const source = path.join(backupDir, name);
  if (!(await exists(path.join(source, 'app.sqlite')))) {
    throw new BackupError(`Нет копии «${name}» в ${backupDir}.`);
  }
  verifyBackup(source);

  // У работающего сервера рядом с БД есть -wal и -shm; после штатной остановки их нет.
  const live = [`${paths.db}-wal`, `${paths.db}-shm`];
  if (!options.force && (await Promise.all(live.map(exists))).some(Boolean)) {
    throw new BackupError(
      'Похоже, сервер работает: рядом с БД есть файлы -wal/-shm. Остановите сервер и повторите. ' +
        'Если он остановился аварийно — добавьте --force (эти файлы тоже уйдут в сторону).',
    );
  }

  const aside = path.join(paths.dataDir, `before-restore-${backupName(options.now ?? new Date())}`);
  await mkdir(aside, { mode: 0o700 });
  for (const file of [paths.db, ...live, paths.filesDir]) {
    if (await exists(file)) await rename(file, path.join(aside, path.basename(file)));
  }
  await copyFile(path.join(source, 'app.sqlite'), paths.db);
  await chmod(paths.db, 0o600);
  await mkdir(paths.filesDir, { recursive: true });
  const { count } = await linkFiles(path.join(source, 'files'), paths.filesDir);
  return { aside, files: count };
}

/**
 * Файлы из одного каталога в другой. Загруженные файлы не меняются, поэтому жёсткая ссылка
 * вместо копии безопасна и не занимает места; на другом диске ссылку не сделать — тогда копия.
 */
async function linkFiles(from: string, to: string): Promise<{ count: number; bytes: number }> {
  let count = 0;
  let bytes = 0;
  for (const entry of await readdir(from, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const source = path.join(from, entry.name);
    const destination = path.join(to, entry.name);
    try {
      await link(source, destination);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') continue; // удалили прямо сейчас — в снимке БД его уже нет
      if (code !== 'EXDEV' && code !== 'EPERM') throw error;
      await copyFile(source, destination);
    }
    count++;
    bytes += (await stat(destination)).size;
  }
  return { count, bytes };
}

/** Снимок открывается, проходит проверку целостности, и все файлы из него на месте. */
export function verifyBackup(dir: string): void {
  const client = new Database(path.join(dir, 'app.sqlite'), { readonly: true });
  try {
    const integrity = client.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') throw new BackupError(`Снимок БД повреждён: ${String(integrity)}`);
    const ids = client.prepare('SELECT id FROM files').pluck().all() as string[];
    const missing = ids.filter((id) => !existsSync(path.join(dir, 'files', id)));
    if (missing.length > 0) {
      throw new BackupError(`В копии нет ${missing.length} файлов, например ${missing[0]}.`);
    }
  } finally {
    client.close();
  }
}

/** Готовые копии от старых к новым. */
export async function listBackups(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isDirectory() && BACKUP_NAME.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

/** Оставляет `keep` последних копий; недописанные копии (после сбоя) тоже убирает. */
async function prune(dir: string, keep: number): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const backups = await listBackups(dir);
  const stale = [
    ...backups.slice(0, Math.max(0, backups.length - keep)),
    ...entries
      .filter((entry) => entry.isDirectory() && entry.name.endsWith(PARTIAL))
      .map((entry) => entry.name),
  ];
  for (const name of stale) await rm(path.join(dir, name), { recursive: true, force: true });
  return stale;
}

async function exists(file: string): Promise<boolean> {
  return stat(file).then(
    () => true,
    () => false,
  );
}
