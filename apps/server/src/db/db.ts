import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { relations } from './relations.ts';

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../../drizzle');

export function openDb(filePath: string) {
  const client = new Database(filePath);
  client.pragma('journal_mode = WAL');
  client.pragma('synchronous = NORMAL');
  client.pragma('busy_timeout = 5000');
  client.pragma('foreign_keys = ON');
  const db = drizzle({ client, relations });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return db;
}

export type AppDb = ReturnType<typeof openDb>;

/** Транзакция: все изменения внутри неё и запись в журнал — одним целым. */
export type Tx = Parameters<Parameters<AppDb['transaction']>[0]>[0];
