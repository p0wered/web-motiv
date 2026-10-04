// Командная строка администратора.
//
//   node apps/server/src/cli.ts <команда>
//
// В Docker: `docker compose exec webmotiv webmotiv <команда>` (обёртка запускает CLI от
// пользователя node, чтобы файлы данных не оказались принадлежащими root).
import { PASSWORD_MIN_LENGTH, passwordProblem } from '@webmotiv/shared';
import { asc } from 'drizzle-orm';
import { PasswordHasher } from './auth/passwords.ts';
import { loadAccess, SessionStore } from './auth/session-store.ts';
import { BackupError, createBackup, listBackups, restoreBackup } from './backup/backup.ts';
import { BootstrapError, createAdmin } from './bootstrap.ts';
import { seedDemo, SeedError } from './demo/seed-demo.ts';
import { PromptCancelledError, promptHidden, promptLine } from './cli/prompt.ts';
import { loadConfig } from './config.ts';
import { openDb } from './db/db.ts';
import { users } from './db/schema.ts';
import { HttpError } from './http/errors.ts';
import { dataPaths, ensureDataDirs } from './paths.ts';
import { type Actor, findUserByLogin, UsersService } from './users/users-service.ts';

const HELP = `Использование: webmotiv <команда>

Команды:
  create-admin            Создать администратора (спросит логин, ФИО и пароль)
  reset-password <логин>  Выдать сотруднику временный пароль (если свой он забыл)
  users                   Список сотрудников и их ролей
  backup                  Сделать резервную копию сейчас (БД и файлы)
  backups                 Список резервных копий
  restore <копия>         Восстановить данные из копии (сервер должен быть остановлен)
  seed-demo               Заполнить пустую базу демо-данными: сотрудники, шаблоны, заказы
  help                    Показать эту справку
`;

/** Действия из CLI в журнале — без сотрудника: их выполняет администратор сервера. */
const CLI_ACTOR: Actor = { id: null, ip: null, permissions: 'all' };

function openApp() {
  const config = loadConfig();
  const paths = dataPaths(config.dataDir);
  ensureDataDirs(paths);
  const db = openDb(paths.db);
  return { config, db, paths };
}

const ATTEMPTS = 3;

async function askNewPassword(login: string): Promise<string | null> {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const retry = attempt < ATTEMPTS ? ' Попробуйте ещё раз.' : '';
    const password = await promptHidden('Пароль: ');
    const problem = passwordProblem(password, { login });
    if (problem) {
      console.error(`${problem}.${retry}`);
      continue;
    }
    if ((await promptHidden('Повторите пароль: ')) !== password) {
      console.error(`Пароли не совпадают.${retry}`);
      continue;
    }
    return password;
  }
  return null;
}

async function createAdminCommand(): Promise<number> {
  const { db } = openApp();
  try {
    console.log('Новый администратор WebMotiv: полные права на сотрудников, роли и настройки.');
    console.log(
      `Пароль — не короче ${PASSWORD_MIN_LENGTH} символов; удобно взять фразу из нескольких слов.`,
    );
    console.log('Вводимые символы пароля показываются звёздочками. Отменить — Ctrl+C.\n');
    const login = (await promptLine('Логин (латиница): ')).trim();
    const fullName = (await promptLine('ФИО: ')).trim();
    const password = await askNewPassword(login);
    if (password === null) {
      console.error('\nАдминистратор не создан: слишком много неудачных попыток.');
      return 1;
    }
    await createAdmin(db, new PasswordHasher(), {
      login,
      fullName,
      password,
      mustChangePassword: false,
    });
    console.log(`\nГотово: администратор «${login}» создан, можно входить.`);
    return 0;
  } catch (error) {
    if (error instanceof BootstrapError) {
      console.error(`\nАдминистратор не создан. ${error.message}`);
      return 1;
    }
    throw error;
  } finally {
    db.$client.close();
  }
}

async function resetPasswordCommand(login: string | undefined): Promise<number> {
  if (!login) {
    console.error('Укажите логин: webmotiv reset-password <логин>');
    return 1;
  }
  const { config, db } = openApp();
  try {
    const user = findUserByLogin(db, login);
    if (!user) {
      console.error(`Сотрудника с логином «${login}» нет. Список: webmotiv users`);
      return 1;
    }
    const service = new UsersService(
      db,
      new PasswordHasher(),
      new SessionStore(db, config.session),
    );
    const temporaryPassword = await service.resetPassword(user.id, CLI_ACTOR);
    console.log(`Временный пароль для «${user.login}»: ${temporaryPassword}`);
    console.log('При входе сотрудник задаст свой. Все его сеансы завершены.');
    if (!user.isActive) {
      console.log('Учётная запись заблокирована — разблокируйте её в разделе «Сотрудники».');
    }
    return 0;
  } catch (error) {
    if (error instanceof HttpError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  } finally {
    db.$client.close();
  }
}

function usersCommand(): number {
  const { db } = openApp();
  try {
    const rows = db.select().from(users).orderBy(asc(users.login)).all();
    if (rows.length === 0) {
      console.log('Сотрудников нет. Создайте администратора: webmotiv create-admin');
      return 0;
    }
    const access = loadAccess(
      db,
      rows.map((row) => row.id),
    );
    for (const row of rows) {
      const roles =
        access
          .get(row.id)
          ?.roles.map((role) => role.name)
          .join(', ') || 'без ролей';
      const status = row.isActive ? '' : ' [заблокирован]';
      console.log(`${row.login.padEnd(20)} ${row.fullName} — ${roles}${status}`);
    }
    return 0;
  } finally {
    db.$client.close();
  }
}

async function backupCommand(): Promise<number> {
  const { config, db, paths } = openApp();
  try {
    const result = await createBackup(db, paths, config.backup);
    const size = (result.bytes / 1024 / 1024).toFixed(1);
    console.log(`Копия готова: ${result.dir}`);
    console.log(`Файлов: ${result.files} (${size} МБ), снимок БД проверен.`);
    if (result.removed.length > 0) {
      console.log(
        `Удалены старые копии (храним ${config.backup.keep}): ${result.removed.join(', ')}`,
      );
    }
    return 0;
  } catch (error) {
    if (error instanceof BackupError) {
      console.error(`Копия не сделана. ${error.message}`);
      return 1;
    }
    throw error;
  } finally {
    db.$client.close();
  }
}

async function backupsCommand(): Promise<number> {
  const config = loadConfig();
  const names = await listBackups(config.backup.dir);
  if (names.length === 0) {
    console.log(`Копий нет (${config.backup.dir}). Сделать сейчас: webmotiv backup`);
    return 0;
  }
  console.log(`Копии в ${config.backup.dir}, от старых к новым:`);
  for (const name of names) console.log(`  ${name}`);
  return 0;
}

async function restoreCommand(args: string[]): Promise<number> {
  const name = args.find((arg) => !arg.startsWith('--'));
  if (!name) {
    console.error('Укажите копию: webmotiv restore <копия>. Список: webmotiv backups');
    return 1;
  }
  const config = loadConfig();
  const paths = dataPaths(config.dataDir);
  try {
    const result = await restoreBackup(paths, config.backup.dir, name, {
      force: args.includes('--force'),
    });
    console.log(`Данные восстановлены из копии ${name} (файлов: ${result.files}).`);
    console.log(`Прежние данные перенесены в ${result.aside} — удалите, когда убедитесь,`);
    console.log('что всё в порядке. Запустите сервер.');
    return 0;
  } catch (error) {
    if (error instanceof BackupError) {
      console.error(`Не восстановлено. ${error.message}`);
      return 1;
    }
    throw error;
  }
}

async function seedDemoCommand(): Promise<number> {
  const { db, paths } = openApp();
  try {
    const result = await seedDemo(db, new PasswordHasher(), paths);
    console.log(`Демо-данные созданы: ${result.orders} заказов, 2 шаблона.\n`);
    console.log('Сотрудники (пароль у всех один):');
    for (const user of result.users) {
      console.log(`  ${user.login.padEnd(10)} ${user.fullName} — ${user.role}`);
    }
    console.log(`\nПароль: ${result.password}`);
    return 0;
  } catch (error) {
    if (error instanceof SeedError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  } finally {
    db.$client.close();
  }
}

const [command, ...rest] = process.argv.slice(2);
let exitCode: number;
try {
  switch (command) {
    case 'create-admin':
      exitCode = await createAdminCommand();
      break;
    case 'reset-password':
      exitCode = await resetPasswordCommand(rest[0]);
      break;
    case 'users':
      exitCode = usersCommand();
      break;
    case 'backup':
      exitCode = await backupCommand();
      break;
    case 'backups':
      exitCode = await backupsCommand();
      break;
    case 'restore':
      exitCode = await restoreCommand(rest);
      break;
    case 'seed-demo':
      exitCode = await seedDemoCommand();
      break;
    case undefined:
    case 'help':
    case '--help':
      console.log(HELP);
      exitCode = 0;
      break;
    default:
      console.error(`Неизвестная команда: ${command}\n\n${HELP}`);
      exitCode = 1;
  }
} catch (error) {
  if (!(error instanceof PromptCancelledError)) throw error;
  console.error('\nОтменено.');
  exitCode = 130;
}
process.exit(exitCode);
