import { mkdirSync } from 'node:fs';
import path from 'node:path';

export interface DataPaths {
  dataDir: string;
  /** БД приложения: всё, кроме содержимого файлов. */
  db: string;
  /** Загруженные документы под UUID-именами. */
  filesDir: string;
  /** Временные файлы загрузок до атомарного переноса в filesDir. */
  tmpDir: string;
}

export function dataPaths(dataDir: string): DataPaths {
  return {
    dataDir,
    db: path.join(dataDir, 'app.sqlite'),
    filesDir: path.join(dataDir, 'files'),
    tmpDir: path.join(dataDir, 'tmp'),
  };
}

export function ensureDataDirs(paths: DataPaths): void {
  mkdirSync(paths.filesDir, { recursive: true });
  mkdirSync(paths.tmpDir, { recursive: true });
}
