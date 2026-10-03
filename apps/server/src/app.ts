import { existsSync } from 'node:fs';
import path from 'node:path';
import fastifyCompress from '@fastify/compress';
import fastifyStatic from '@fastify/static';
import type { HealthResponse } from '@webmotiv/shared';
import Fastify, { type FastifyBaseLogger, type FastifyError, type FastifyInstance } from 'fastify';
import type { AppConfig } from './config.ts';
import { isApi, registerSecurity } from './http/security.ts';

/** Части приложения; тесты подключают только нужные. */
export interface AppDeps {
  /** Общий логгер процесса. */
  logger?: FastifyBaseLogger;
}

/** Секреты не попадают в логи, даже если уровень логов поднимут до debug. */
export const LOG_REDACT = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
];

export async function buildApp(config: AppConfig, deps: AppDeps = {}): Promise<FastifyInstance> {
  const app = Fastify({
    ...(deps.logger
      ? { loggerInstance: deps.logger }
      : { logger: { level: config.logLevel, redact: LOG_REDACT } }),
    trustProxy: config.trustProxy,
  });

  await registerSecurity(app);
  await app.register(fastifyCompress, { threshold: 1024 });

  // Наружу — без внутренних подробностей: текст ошибки сервера уходит только в лог.
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) {
      request.log.error(error);
      return reply.code(status).send({ error: 'Внутренняя ошибка сервера.' });
    }
    return reply.code(status).send({ error: error.message });
  });

  await app.register(
    async (api) => {
      api.get('/health', async (): Promise<HealthResponse> => ({
        status: 'ok',
        uptimeSeconds: Math.round(process.uptime()),
      }));
    },
    { prefix: '/api' },
  );

  const hasWebDist = existsSync(path.join(config.webDistDir, 'index.html'));
  if (hasWebDist) {
    await app.register(fastifyStatic, { root: config.webDistDir, wildcard: false });
  }

  app.setNotFoundHandler((request, reply) => {
    const isPageRequest = request.method === 'GET' || request.method === 'HEAD';
    if (hasWebDist && isPageRequest && !isApi(request)) {
      // SPA: любые неизвестные страницы отдаются фронту, маршрутизирует React Router.
      return reply.sendFile('index.html');
    }
    return reply.code(404).send({ error: 'Не найдено' });
  });

  return app;
}
