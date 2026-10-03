// Вход, выход, свой пароль и свои сеансы.
import {
  changePasswordRequestSchema,
  loginRequestSchema,
  type MeResponse,
  passwordProblem,
  plural,
  sessionParamsSchema,
  type SessionInfo,
} from '@webmotiv/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import {
  clearSessionCookie,
  type CookieSecure,
  readSessionToken,
  requireAuth,
  setSessionCookie,
} from '../auth/access.ts';
import type { LimiterKey, LoginLimiter } from '../auth/login-limiter.ts';
import type { PasswordHasher } from '../auth/passwords.ts';
import type { AuthContext, SessionStore } from '../auth/session-store.ts';
import type { AppDb } from '../db/db.ts';
import { users } from '../db/schema.ts';
import { recordEvent } from '../events/event-log.ts';
import { fieldError, HttpError, notFound, parseInput, parseParams } from '../http/errors.ts';
import { findUserByLogin } from '../users/users-service.ts';

export interface AuthRouteDeps {
  db: AppDb;
  hasher: PasswordHasher;
  sessions: SessionStore;
  /** Попытки входа — по IP и логину. */
  loginLimiter: LoginLimiter;
  /** Попытки ввести текущий пароль при его смене — по сотруднику. */
  passwordLimiter: LoginLimiter;
  cookieSecure: CookieSecure;
}

const INVALID_CREDENTIALS = 'Неверный логин или пароль';

export function waitText(seconds: number): string {
  if (seconds < 60) return `${seconds} ${plural(seconds, ['секунду', 'секунды', 'секунд'])}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} ${plural(minutes, ['минуту', 'минуты', 'минут'])}`;
}

function tooManyAttempts(reply: FastifyReply, seconds: number, what: string) {
  return reply
    .code(429)
    .header('retry-after', String(seconds))
    .send({ error: `Слишком много попыток ${what}. Попробуйте через ${waitText(seconds)}.` });
}

export function meOf(auth: AuthContext): MeResponse {
  return {
    ...auth.user,
    permissions: [...auth.permissions],
    roles: auth.roles,
  };
}

const userAgentOf = (request: FastifyRequest) => request.headers['user-agent'] ?? null;

export function registerAuthRoutes(api: FastifyInstance, deps: AuthRouteDeps): void {
  const { db, hasher, sessions, loginLimiter, passwordLimiter, cookieSecure } = deps;

  api.post('/auth/login', { config: { access: 'public' } }, async (request, reply) => {
    const body = parseInput(loginRequestSchema, request.body);
    const keys: LimiterKey[] = [
      { kind: 'ip', value: request.ip },
      { kind: 'login', value: body.login },
    ];
    const retryAfter = loginLimiter.retryAfterSeconds(keys);
    if (retryAfter > 0) return tooManyAttempts(reply, retryAfter, 'входа');

    const user = findUserByLogin(db, body.login);
    const valid = user
      ? await hasher.verify(body.password, user.passwordHash)
      : await hasher.verifyDummy(body.password);
    if (!user || !valid) {
      loginLimiter.recordFailure(keys);
      recordEvent(db, {
        actorId: user?.id ?? null,
        action: 'auth.login_failed',
        entityType: 'user',
        entityId: user?.id ?? null,
        ip: request.ip,
        // Неизвестный логин не пишем: туда по ошибке часто вводят пароль.
        payload: { reason: user ? 'wrong_password' : 'unknown_login' },
      });
      throw new HttpError(422, INVALID_CREDENTIALS, { fields: { password: INVALID_CREDENTIALS } });
    }
    if (!user.isActive) {
      recordEvent(db, {
        actorId: user.id,
        action: 'auth.login_failed',
        entityType: 'user',
        entityId: user.id,
        ip: request.ip,
        payload: { reason: 'blocked' },
      });
      throw new HttpError(403, 'Учётная запись заблокирована. Обратитесь к администратору.');
    }

    loginLimiter.reset(keys);
    if (hasher.needsRehash(user.passwordHash)) {
      const passwordHash = await hasher.hash(body.password);
      db.update(users).set({ passwordHash }).where(eq(users.id, user.id)).run();
    }
    // Прежний сеанс в этом браузере (если был) больше не нужен: у входа всегда новый токен.
    const previous = readSessionToken(request);
    if (previous) sessions.deleteByToken(previous);
    sessions.deleteExpired();

    const session = sessions.create(user.id, { ip: request.ip, userAgent: userAgentOf(request) });
    db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id)).run();
    recordEvent(db, {
      actorId: user.id,
      action: 'auth.login_succeeded',
      entityType: 'user',
      entityId: user.id,
      ip: request.ip,
    });
    setSessionCookie(reply, request, session.token, session.absoluteExpiresAt, cookieSecure);
    const auth = sessions.authenticate(session.token);
    if (!auth) throw new Error('Только что созданный сеанс не найден');
    return meOf(auth);
  });

  api.post(
    '/auth/logout',
    { config: { access: 'authenticated', allowDuringPasswordChange: true } },
    async (request, reply) => {
      const auth = requireAuth(request);
      sessions.delete(auth.sessionId);
      recordEvent(db, {
        actorId: auth.user.id,
        action: 'auth.logout',
        entityType: 'user',
        entityId: auth.user.id,
        ip: request.ip,
      });
      clearSessionCookie(reply);
      return reply.code(204).send();
    },
  );

  api.get(
    '/auth/me',
    { config: { access: 'authenticated', allowDuringPasswordChange: true } },
    async (request): Promise<MeResponse> => meOf(requireAuth(request)),
  );

  api.post(
    '/auth/password',
    { config: { access: 'authenticated', allowDuringPasswordChange: true } },
    async (request, reply) => {
      const auth = requireAuth(request);
      const body = parseInput(changePasswordRequestSchema, request.body);
      const user = db.select().from(users).where(eq(users.id, auth.user.id)).get();
      if (!user) throw notFound();

      // Сразу после входа с временным паролем сотрудник его только что ввёл — не спрашиваем.
      if (!user.mustChangePassword) {
        const keys: LimiterKey[] = [{ kind: 'login', value: String(user.id) }];
        const retryAfter = passwordLimiter.retryAfterSeconds(keys);
        if (retryAfter > 0) return tooManyAttempts(reply, retryAfter, 'ввода пароля');
        if (!body.current) throw fieldError('current', 'Введите текущий пароль');
        if (!(await hasher.verify(body.current, user.passwordHash))) {
          passwordLimiter.recordFailure(keys);
          throw fieldError('current', 'Неверный пароль');
        }
        passwordLimiter.reset(keys);
      }
      const problem = passwordProblem(body.password, { login: user.login });
      if (problem) throw fieldError('password', problem);
      if (await hasher.verify(body.password, user.passwordHash)) {
        throw fieldError('password', 'Новый пароль совпадает с прежним');
      }

      const passwordHash = await hasher.hash(body.password);
      db.transaction((tx) => {
        tx.update(users)
          .set({ passwordHash, mustChangePassword: false })
          .where(eq(users.id, user.id))
          .run();
        // Остальные сеансы завершаются: если пароль меняют из-за утечки, чужой вход прервётся.
        sessions.deleteForUser(tx, user.id, auth.sessionId);
        recordEvent(tx, {
          actorId: user.id,
          action: 'auth.password_changed',
          entityType: 'user',
          entityId: user.id,
          ip: request.ip,
        });
      });
      return reply.code(204).send();
    },
  );

  api.get(
    '/auth/sessions',
    { config: { access: 'authenticated' } },
    async (request): Promise<SessionInfo[]> => {
      const auth = requireAuth(request);
      return sessions.list(auth.user.id, auth.sessionId);
    },
  );

  api.delete(
    '/auth/sessions/:id',
    { config: { access: 'authenticated' } },
    async (request, reply) => {
      const auth = requireAuth(request);
      const { id } = parseParams(sessionParamsSchema, request.params);
      if (!sessions.deleteOwn(auth.user.id, id)) throw notFound('Сеанс не найден');
      recordEvent(db, {
        actorId: auth.user.id,
        action: 'auth.sessions_terminated',
        entityType: 'user',
        entityId: auth.user.id,
        ip: request.ip,
        payload: { count: 1 },
      });
      if (id === auth.sessionId) clearSessionCookie(reply);
      return reply.code(204).send();
    },
  );

  // Все, кроме текущего: «выйти на других устройствах».
  api.delete('/auth/sessions', { config: { access: 'authenticated' } }, async (request, reply) => {
    const auth = requireAuth(request);
    const terminated = sessions.deleteForUser(db, auth.user.id, auth.sessionId);
    recordEvent(db, {
      actorId: auth.user.id,
      action: 'auth.sessions_terminated',
      entityType: 'user',
      entityId: auth.user.id,
      ip: request.ip,
      payload: { count: terminated },
    });
    return reply.code(204).send();
  });
}
