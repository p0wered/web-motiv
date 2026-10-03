import pino from 'pino';
import { buildApp, LOG_REDACT } from './app.ts';
import { loadConfig } from './config.ts';
import { openDb } from './db/db.ts';
import { dataPaths, ensureDataDirs } from './paths.ts';

const config = loadConfig();
const log = pino({ level: config.logLevel, redact: LOG_REDACT });

const paths = dataPaths(config.dataDir);
ensureDataDirs(paths);
const db = openDb(paths.db);

const app = await buildApp(config, { logger: log });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    log.info({ signal }, 'Остановка сервера');
    app.close().then(
      () => {
        db.$client.close();
        process.exit(0);
      },
      (error: unknown) => {
        log.error(error, 'Ошибка при остановке');
        process.exit(1);
      },
    );
  });
}

await app.listen({ host: config.host, port: config.port });
