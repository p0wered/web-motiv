// Доступ к API (PLAN.md §7.2): всё запрещено по умолчанию. Каждый маршрут /api объявляет в
// `config.access`, кому он открыт; маршрут без объявления не регистрируется — сервер не стартует.
import fastifyCookie from '@fastify/cookie';
import { type Permission, PASSWORD_CHANGE_REQUIRED } from '@webmotiv/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { isApi } from '../http/security.ts';
import type { AuthContext, SessionStore } from './session-store.ts';

/**
 * `public` — без входа; `authenticated` — любой вошедший; право или список прав — нужно
 * хотя бы одно из них.
 */
export type Access = 'public' | 'authenticated' | Permission | readonly Permission[];

declare module 'fastify' {
  interface FastifyContextConfig {
    access?: Access;
    /** Маршрут доступен и сотруднику, который ещё не сменил временный пароль. */
    allowDuringPasswordChange?: boolean;
  }
  interface FastifyRequest {
    auth: AuthContext | null;
  }
  interface FastifyInstance {
    /** Все маршруты /api с их доступом — для теста матрицы доступа. */
    apiRoutes: ApiRoute[];
  }
}

export interface ApiRoute {
  method: string;
  url: string;
  access: Access;
}

export type CookieSecure = 'auto' | boolean;

export interface AccessOptions {
  sessions: SessionStore;
  cookieSecure: CookieSecure;
}

// Префикс __Host- браузер принимает только с Secure, Path=/ и без Domain: cookie нельзя
// подменить с поддомена. По HTTP (демо на ноутбуке) — имя без префикса.
const SECURE_COOKIE = '__Host-webmotiv_session';
const PLAIN_COOKIE = 'webmotiv_session';

function isSecure(request: FastifyRequest, cookieSecure: CookieSecure): boolean {
  return cookieSecure === 'auto' ? request.protocol === 'https' : cookieSecure;
}

export function readSessionToken(request: FastifyRequest): string | undefined {
  return request.cookies[SECURE_COOKIE] ?? request.cookies[PLAIN_COOKIE];
}

export function setSessionCookie(
  reply: FastifyReply,
  request: FastifyRequest,
  token: string,
  expiresAt: Date,
  cookieSecure: CookieSecure,
): void {
  const secure = isSecure(request, cookieSecure);
  reply.setCookie(secure ? SECURE_COOKIE : PLAIN_COOKIE, token, {
    path: '/',
    httpOnly: true,
    // Strict: со страниц других сайтов cookie не уходит совсем. SPA это не мешает — её
    // запросы к API всегда с нашей же страницы.
    sameSite: 'strict',
    secure,
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  if (reply.request.cookies[SECURE_COOKIE] !== undefined) {
    reply.clearCookie(SECURE_COOKIE, { path: '/', secure: true, sameSite: 'strict' });
  }
  if (reply.request.cookies[PLAIN_COOKIE] !== undefined) {
    reply.clearCookie(PLAIN_COOKIE, { path: '/', sameSite: 'strict' });
  }
}

export function hasAccess(auth: AuthContext, access: Access): boolean {
  if (access === 'public' || access === 'authenticated') return true;
  const required: readonly Permission[] = typeof access === 'string' ? [access] : access;
  return required.some((permission) => auth.permissions.has(permission));
}

/** Сотрудник из запроса — для маршрутов, закрытых проверкой доступа. */
export function requireAuth(request: FastifyRequest): AuthContext {
  if (!request.auth) throw new Error('Маршрут без проверки входа обратился к request.auth');
  return request.auth;
}

export async function registerAccessControl(
  app: FastifyInstance,
  options: AccessOptions,
): Promise<void> {
  await app.register(fastifyCookie);
  app.decorateRequest('auth', null);
  app.decorate('apiRoutes', [] as ApiRoute[]);

  app.addHook('onRoute', (route) => {
    if (!route.url.startsWith('/api')) return;
    const methods = [route.method].flat();
    const access = route.config?.access;
    if (access === undefined) {
      throw new Error(
        `Маршрут ${methods.join(',')} ${route.url} не объявляет доступ (config.access)`,
      );
    }
    for (const method of methods) {
      if (method !== 'HEAD') app.apiRoutes.push({ method, url: route.url, access });
    }
  });

  app.addHook('onRequest', async (request, reply) => {
    if (!isApi(request) || request.is404) return;
    const config = request.routeOptions.config;
    if (config.access === 'public') return;

    const token = readSessionToken(request);
    const auth = token ? options.sessions.authenticate(token) : null;
    if (!auth) {
      clearSessionCookie(reply);
      return reply.code(401).send({ error: 'Требуется вход.' });
    }
    request.auth = auth;

    if (auth.user.mustChangePassword && !config.allowDuringPasswordChange) {
      return reply
        .code(403)
        .send({ error: 'Сначала задайте свой пароль.', code: PASSWORD_CHANGE_REQUIRED });
    }
    if (config.access === undefined || !hasAccess(auth, config.access)) {
      return reply.code(403).send({ error: 'Недостаточно прав.' });
    }
  });
}
