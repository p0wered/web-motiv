import pino from 'pino';
import { buildApp, LOG_REDACT } from './app.ts';
import { PasswordHasher } from './auth/passwords.ts';
import { createBackup } from './backup/backup.ts';
import { scheduleDaily } from './backup/scheduler.ts';
import { BootstrapError, createAdmin, ensureDefaultRoles, hasUsers } from './bootstrap.ts';
import { loadConfig } from './config.ts';
import { openDb } from './db/db.ts';
import { dataPaths, ensureDataDirs } from './paths.ts';

const config = loadConfig();
const log = pino({ level: config.logLevel, redact: LOG_REDACT });

const paths = dataPaths(config.dataDir);
ensureDataDirs(paths);
const db = openDb(paths.db);
const hasher = new PasswordHasher();

if (ensureDefaultRoles(db)) log.info('Созданы роли по умолчанию');
if (!hasUsers(db)) {
  if (config.initialAdmin) {
    try {
      await createAdmin(db, hasher, {
        login: config.initialAdmin.login,
        fullName: 'Администратор',
        password: config.initialAdmin.password,
        mustChangePassword: true,
      });
      log.info(
        { login: config.initialAdmin.login },
        'Создан первый администратор из INITIAL_ADMIN_*: при входе он задаст свой пароль',
      );
    } catch (error) {
      if (!(error instanceof BootstrapError)) throw error;
      log.fatal(error.message);
      process.exit(1);
    }
  } else {
    log.warn(
      'Сотрудников ещё нет. Создайте администратора: `webmotiv create-admin` ' +
        '(или задайте INITIAL_ADMIN_LOGIN и INITIAL_ADMIN_PASSWORD).',
    );
  }
}

const app = await buildApp(config, { db, hasher, logger: log });

const stopBackups = config.backup.time
  ? scheduleDaily(config.backup.time, async () => {
      try {
        const result = await createBackup(db, paths, config.backup);
        log.info(
          { dir: result.dir, files: result.files, removed: result.removed },
          'Резервная копия готова',
        );
      } catch (error) {
        log.error(error, 'Резервная копия не удалась');
      }
    })
  : null;

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    log.info({ signal }, 'Остановка сервера');
    stopBackups?.();
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
