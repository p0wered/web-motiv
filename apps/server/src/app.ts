import { existsSync } from 'node:fs';
import path from 'node:path';
import fastifyCompress from '@fastify/compress';
import fastifyStatic from '@fastify/static';
import type { HealthResponse } from '@webmotiv/shared';
import Fastify, { type FastifyBaseLogger, type FastifyError, type FastifyInstance } from 'fastify';
import { registerAuthRoutes } from './api/auth-routes.ts';
import { registerEventsRoutes } from './api/events-routes.ts';
import { registerRolesRoutes } from './api/roles-routes.ts';
import { registerStagesRoutes } from './api/stages-routes.ts';
import { registerTemplatesRoutes } from './api/templates-routes.ts';
import { registerUsersRoutes } from './api/users-routes.ts';
import { registerAccessControl } from './auth/access.ts';
import { LoginLimiter } from './auth/login-limiter.ts';
import type { PasswordHasher } from './auth/passwords.ts';
import { SessionStore } from './auth/session-store.ts';
import type { AppConfig } from './config.ts';
import type { AppDb } from './db/db.ts';
import { HttpError } from './http/errors.ts';
import { isApi, registerSecurity } from './http/security.ts';
import { RolesService } from './roles/roles-service.ts';
import { StagesService } from './stages/stages-service.ts';
import { TemplatesService } from './templates/templates-service.ts';
import { UsersService } from './users/users-service.ts';

export interface AppDeps {
  db: AppDb;
  hasher: PasswordHasher;
  /** Общий логгер процесса. */
  logger?: FastifyBaseLogger;
  loginLimiter?: LoginLimiter;
  passwordLimiter?: LoginLimiter;
}

/** Секреты не попадают в логи, даже если уровень логов поднимут до debug. */
export const LOG_REDACT = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
];

export async function buildApp(config: AppConfig, deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    ...(deps.logger
      ? { loggerInstance: deps.logger }
      : { logger: { level: config.logLevel, redact: LOG_REDACT } }),
    trustProxy: config.trustProxy,
  });

  const sessions = new SessionStore(deps.db, config.session);
  await registerSecurity(app);
  await registerAccessControl(app, { sessions, cookieSecure: config.cookieSecure });
  await app.register(fastifyCompress, { threshold: 1024 });

  // Наружу — без внутренних подробностей: текст ошибки сервера уходит только в лог.
  app.setErrorHandler<FastifyError | HttpError>((error, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) {
      request.log.error(error);
      return reply.code(status).send({ error: 'Внутренняя ошибка сервера.' });
    }
    if (error instanceof HttpError) {
      return reply.code(status).send({
        error: error.message,
        ...(error.fields ? { fields: error.fields } : {}),
        ...(error.code ? { code: error.code } : {}),
      });
    }
    return reply.code(status).send({ error: error.message });
  });

  await app.register(
    async (api) => {
      api.get('/health', { config: { access: 'public' } }, async (): Promise<HealthResponse> => ({
        status: 'ok',
        uptimeSeconds: Math.round(process.uptime()),
      }));
      registerAuthRoutes(api, {
        db: deps.db,
        hasher: deps.hasher,
        sessions,
        loginLimiter: deps.loginLimiter ?? new LoginLimiter(),
        passwordLimiter: deps.passwordLimiter ?? new LoginLimiter(),
        cookieSecure: config.cookieSecure,
      });
      registerUsersRoutes(api, new UsersService(deps.db, deps.hasher, sessions));
      registerRolesRoutes(api, new RolesService(deps.db));
      registerStagesRoutes(api, new StagesService(deps.db));
      registerTemplatesRoutes(api, new TemplatesService(deps.db));
      registerEventsRoutes(api, deps.db);
    },
    { prefix: '/api' },
  );

  const hasWebDist = existsSync(path.join(config.webDistDir, 'index.html'));
  if (hasWebDist) {
    await app.register(fastifyStatic, {
      root: config.webDistDir,
      wildcard: false,
      // Файлы сборки с хэшем в имени не меняются — кэшируются надолго; index.html — всегда
      // свежий, иначе после обновления браузер искал бы скрипты прошлой сборки.
      setHeaders: (reply, filePath) => {
        reply.header(
          'cache-control',
          filePath.includes(`${path.sep}assets${path.sep}`)
            ? 'public, max-age=31536000, immutable'
            : 'no-cache',
        );
      },
    });
  }

  app.setNotFoundHandler((request, reply) => {
    const isPageRequest = request.method === 'GET' || request.method === 'HEAD';
    // Адрес с расширением — это файл (скрипт, картинка): его нет — значит 404, а не страница.
    const isFile = /\.[a-z0-9]+$/i.test(request.url.split('?')[0] ?? '');
    if (hasWebDist && isPageRequest && !isApi(request) && !isFile) {
      // SPA: любые неизвестные страницы отдаются фронту, маршрутизирует React Router.
      return reply.header('cache-control', 'no-cache').sendFile('index.html');
    }
    return reply.code(404).send({ error: 'Не найдено' });
  });

  return app;
}
