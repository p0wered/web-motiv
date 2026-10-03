import { inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.ts';
import { DEFAULT_LIMITER_OPTIONS, LoginLimiter } from '../auth/login-limiter.ts';
import { PasswordHasher } from '../auth/passwords.ts';
import { ensureDefaultRoles } from '../bootstrap.ts';
import type { AppConfig } from '../config.ts';
import { type AppDb, openDb } from '../db/db.ts';
import { roles, userRoles, users } from '../db/schema.ts';
import { testConfig } from './test-config.ts';

/** Слабые параметры scrypt — только чтобы тесты не ждали по 300 мс на пароль. */
export const testHasher = () => new PasswordHasher({ N: 2 ** 10, r: 8, p: 1 });

export const STRONG_PASSWORD = 'синий трамвай едет в депо';

export interface TestApp {
  app: FastifyInstance;
  db: AppDb;
  hasher: PasswordHasher;
  loginLimiter: LoginLimiter;
}

export async function createTestApp(config: Partial<AppConfig> = {}): Promise<TestApp> {
  const db = openDb(':memory:');
  ensureDefaultRoles(db);
  const hasher = testHasher();
  const loginLimiter = new LoginLimiter(DEFAULT_LIMITER_OPTIONS);
  const app = await buildApp(testConfig(config), { db, hasher, loginLimiter });
  return { app, db, hasher, loginLimiter };
}

export interface TestUserInput {
  login: string;
  roles?: string[];
  password?: string;
  mustChangePassword?: boolean;
  isActive?: boolean;
}

/** Сотрудник прямо в БД — минуя API. */
export async function addUser(t: TestApp, input: TestUserInput): Promise<number> {
  const user = t.db
    .insert(users)
    .values({
      login: input.login,
      fullName: `Сотрудник ${input.login}`,
      passwordHash: await t.hasher.hash(input.password ?? STRONG_PASSWORD),
      mustChangePassword: input.mustChangePassword ?? false,
      isActive: input.isActive ?? true,
      createdAt: new Date(),
    })
    .returning()
    .get();
  const roleNames = input.roles ?? [];
  if (roleNames.length > 0) {
    const found = t.db.select().from(roles).where(inArray(roles.name, roleNames)).all();
    t.db
      .insert(userRoles)
      .values(found.map((role) => ({ userId: user.id, roleId: role.id })))
      .run();
  }
  return user.id;
}

export const CSRF = { 'x-requested-with': 'webmotiv' };

/** Вход через API; возвращает заголовки для следующих запросов (cookie + CSRF). */
export async function loginAs(
  t: TestApp,
  login: string,
  password = STRONG_PASSWORD,
): Promise<Record<string, string>> {
  const response = await t.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: CSRF,
    payload: { login, password },
  });
  if (response.statusCode !== 200) {
    throw new Error(`Вход ${login}: ${response.statusCode} ${response.body}`);
  }
  const cookie = response.cookies.find((item) => item.name.endsWith('webmotiv_session'));
  if (!cookie) throw new Error('Нет cookie сессии');
  return { ...CSRF, cookie: `${cookie.name}=${cookie.value}` };
}
