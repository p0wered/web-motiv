// Заголовки безопасности и защита от CSRF — для всех ответов приложения (PLAN.md §7.3).
import fastifyHelmet from '@fastify/helmet';
import { CSRF_HEADER, CSRF_HEADER_VALUE } from '@webmotiv/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const PERMISSIONS_POLICY = [
  'camera=()',
  'microphone=()',
  'geolocation=()',
  'payment=()',
  'usb=()',
  'interest-cohort=()',
].join(', ');

export async function registerSecurity(app: FastifyInstance): Promise<void> {
  await app.register(fastifyHelmet, {
    // Всё своё: скрипты, стили и шрифты — только с нашего адреса, без встроенных скриптов
    // (тема до отрисовки — отдельный файл theme-init.js), без фреймов и плагинов.
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        fontSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    // Браузер игнорирует HSTS по HTTP, так что заголовок безопасен и на демо без HTTPS.
    strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: true },
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginEmbedderPolicy: false,
  });

  app.addHook('onSend', async (_request, reply) => {
    reply.header('permissions-policy', PERMISSIONS_POLICY);
  });

  // Изменяющие запросы к API — только со своей страницы: свой заголовок (чужой сайт не может
  // его выставить без CORS) и, если браузер прислал Sec-Fetch-Site, — `same-origin`.
  app.addHook('onRequest', async (request, reply) => {
    if (SAFE_METHODS.has(request.method) || !isApi(request)) return;
    if (request.headers[CSRF_HEADER] !== CSRF_HEADER_VALUE || !fromOwnPage(request)) {
      return reply.code(403).send({ error: 'Запрос отклонён.' });
    }
  });
}

export function isApi(request: FastifyRequest): boolean {
  return request.url === '/api' || request.url.startsWith('/api/');
}

/**
 * Sec-Fetch-Site браузер выставляет сам (скрипт его не подделает) по адресу, который видит
 * пользователь. Сравнивать Origin с Host нельзя: прокси (Vite в разработке, nginx у заказчика)
 * подменяет Host на адрес сервера, и свои же запросы выглядели бы чужими. Без заголовка
 * (старый браузер, curl) остаётся проверка CSRF-заголовка.
 */
function fromOwnPage(request: FastifyRequest): boolean {
  const site = request.headers['sec-fetch-site'];
  return site === undefined || site === 'same-origin';
}
