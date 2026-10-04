import path from 'node:path';
import { z } from 'zod';

/** docker-compose передаёт незаданные переменные пустой строкой: это значит «не задано». */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

/**
 * Каким прокси верить в X-Forwarded-For: `false` — никаким (сервис открыт напрямую),
 * иначе — список адресов или подсетей через запятую. `true` («верить всем») не принимается:
 * при прямом доступе к порту заголовок подделывается, и лимит попыток входа по IP обходится.
 */
const trustProxySchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(
    z.string().refine((value) => value !== 'true', {
      message: 'true не допускается — укажите адреса прокси, например 172.17.0.1 или 10.0.0.0/8',
    }),
  )
  .transform((value): false | string[] => {
    if (value === 'false') return false;
    const list = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return list.length > 0 ? list : false;
  });

/** Время ночной копии `ЧЧ:ММ` (местное) или `off`. */
const backupTimeSchema = z
  .string()
  .trim()
  .transform((value, ctx): { hours: number; minutes: number } | null => {
    if (value === 'off') return null;
    const match = /^(\d{1,2}):(\d{2})$/.exec(value);
    const hours = Number(match?.[1]);
    const minutes = Number(match?.[2]);
    if (!match || hours > 23 || minutes > 59) {
      ctx.addIssue({ code: 'custom', message: 'нужно время ЧЧ:ММ, например 03:00, или off' });
      return z.NEVER;
    }
    return { hours, minutes };
  });

const envSchema = z.object({
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY: optional(trustProxySchema),
  WEB_DIST_DIR: optional(z.string()),
  DATA_DIR: optional(z.string()),
  // Сессия: тайм-аут бездействия (минуты) и абсолютный срок (часы) — вход раз в рабочий день.
  SESSION_IDLE_MINUTES: optional(
    z.coerce
      .number()
      .int()
      .min(1)
      .max(24 * 60),
  ),
  SESSION_ABSOLUTE_HOURS: optional(
    z.coerce
      .number()
      .int()
      .min(1)
      .max(24 * 30),
  ),
  // auto — флаг Secure у cookie, если запрос пришёл по HTTPS (за прокси — по X-Forwarded-Proto).
  COOKIE_SECURE: optional(z.enum(['auto', 'true', 'false'])),
  // Резервные копии: каталог (по умолчанию data/backups), время, сколько хранить.
  BACKUP_DIR: optional(z.string()),
  BACKUP_TIME: optional(backupTimeSchema),
  BACKUP_KEEP: optional(z.coerce.number().int().min(1).max(365)),
  // Первый администратор, если сотрудников ещё нет; при первом входе пароль нужно сменить.
  INITIAL_ADMIN_LOGIN: optional(z.string()),
  INITIAL_ADMIN_PASSWORD: optional(z.string()),
});

export interface AppConfig {
  host: string;
  port: number;
  logLevel: string;
  /** Адреса доверенных прокси; `false` — X-Forwarded-* игнорируются. */
  trustProxy: false | string[];
  /** Каталог собранного фронта; если его нет, сервер отдаёт только API. */
  webDistDir: string;
  /** Каталог данных: БД, файлы, временные файлы. */
  dataDir: string;
  session: { idleMs: number; absoluteMs: number };
  cookieSecure: 'auto' | boolean;
  backup: {
    dir: string;
    /** Местное время ночной копии; `null` — по расписанию не делать. */
    time: { hours: number; minutes: number } | null;
    keep: number;
  };
  initialAdmin: { login: string; password: string } | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Некорректные переменные окружения: ${details}`);
  }
  const values = parsed.data;
  const cookieSecure = values.COOKIE_SECURE ?? 'auto';
  const adminLogin = values.INITIAL_ADMIN_LOGIN?.trim();
  const dataDir = path.resolve(
    values.DATA_DIR ?? path.resolve(import.meta.dirname, '../../../data'),
  );
  return {
    host: values.HOST,
    port: values.PORT,
    logLevel: values.LOG_LEVEL,
    trustProxy: values.TRUST_PROXY ?? false,
    webDistDir: values.WEB_DIST_DIR ?? path.resolve(import.meta.dirname, '../../web/dist'),
    dataDir,
    session: {
      idleMs: (values.SESSION_IDLE_MINUTES ?? 120) * 60_000,
      absoluteMs: (values.SESSION_ABSOLUTE_HOURS ?? 12) * 3_600_000,
    },
    cookieSecure: cookieSecure === 'auto' ? 'auto' : cookieSecure === 'true',
    backup: {
      dir: path.resolve(values.BACKUP_DIR ?? path.join(dataDir, 'backups')),
      time: values.BACKUP_TIME === undefined ? { hours: 3, minutes: 0 } : values.BACKUP_TIME,
      keep: values.BACKUP_KEEP ?? 14,
    },
    initialAdmin:
      adminLogin && values.INITIAL_ADMIN_PASSWORD
        ? { login: adminLogin, password: values.INITIAL_ADMIN_PASSWORD }
        : null,
  };
}
