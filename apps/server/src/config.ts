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

const envSchema = z.object({
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY: optional(trustProxySchema),
  WEB_DIST_DIR: optional(z.string()),
  DATA_DIR: optional(z.string()),
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
  return {
    host: values.HOST,
    port: values.PORT,
    logLevel: values.LOG_LEVEL,
    trustProxy: values.TRUST_PROXY ?? false,
    webDistDir: values.WEB_DIST_DIR ?? path.resolve(import.meta.dirname, '../../web/dist'),
    dataDir: path.resolve(values.DATA_DIR ?? path.resolve(import.meta.dirname, '../../../data')),
  };
}
