import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CSRF_HEADER, CSRF_HEADER_VALUE } from '@webmotiv/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import { testConfig } from './test-support/test-config.ts';

describe('app', () => {
  it('отвечает на /api/health', async () => {
    const app = await buildApp(testConfig());
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
  });

  it('отдаёт заголовки безопасности', async () => {
    const app = await buildApp(testConfig());
    const { headers } = await app.inject({ method: 'GET', url: '/api/health' });
    const csp = String(headers['content-security-policy']);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain('unsafe-inline');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('no-referrer');
    expect(headers['strict-transport-security']).toContain('max-age=');
    expect(headers['permissions-policy']).toContain('camera=()');
  });

  it('отклоняет изменяющий запрос без CSRF-заголовка', async () => {
    const app = await buildApp(testConfig());
    const response = await app.inject({ method: 'POST', url: '/api/health' });
    expect(response.statusCode).toBe(403);
  });

  it('отклоняет изменяющий запрос с чужим Origin', async () => {
    const app = await buildApp(testConfig());
    const response = await app.inject({
      method: 'POST',
      url: '/api/health',
      headers: {
        [CSRF_HEADER]: CSRF_HEADER_VALUE,
        host: 'motiv.local',
        origin: 'https://evil.example',
      },
    });
    expect(response.statusCode).toBe(403);
  });

  it('пропускает изменяющий запрос со своей страницы', async () => {
    const app = await buildApp(testConfig());
    const response = await app.inject({
      method: 'POST',
      url: '/api/health',
      headers: {
        [CSRF_HEADER]: CSRF_HEADER_VALUE,
        host: 'motiv.local',
        origin: 'https://motiv.local',
      },
    });
    // Маршрута нет — но до него запрос дошёл.
    expect(response.statusCode).toBe(404);
  });

  it('без доверенного прокси не верит X-Forwarded-For', async () => {
    const app = await buildApp(testConfig());
    app.get('/api/ip', async (request) => ({ ip: request.ip }));
    const response = await app.inject({
      method: 'GET',
      url: '/api/ip',
      headers: { 'x-forwarded-for': '203.0.113.7' },
    });
    expect(response.json()).toEqual({ ip: '127.0.0.1' });
  });

  it('скрывает текст внутренней ошибки', async () => {
    const app = await buildApp(testConfig());
    app.get('/api/boom', async () => {
      throw new Error('секретная подробность');
    });
    const response = await app.inject({ method: 'GET', url: '/api/boom' });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('секретная');
  });

  it('неизвестный маршрут API — 404 в JSON', async () => {
    const app = await buildApp(testConfig());
    const response = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Не найдено' });
  });

  describe('со сборкой фронта', () => {
    const dist = mkdtempSync(path.join(tmpdir(), 'webmotiv-dist-'));
    writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>WebMotiv</title>');
    afterAll(() => rmSync(dist, { recursive: true, force: true }));

    it('отдаёт index.html на любые страницы SPA', async () => {
      const app = await buildApp(testConfig({ webDistDir: dist }));
      const response = await app.inject({ method: 'GET', url: '/orders/42' });
      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('WebMotiv');
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('отвечает на HEAD к странице SPA', async () => {
      const app = await buildApp(testConfig({ webDistDir: dist }));
      const response = await app.inject({ method: 'HEAD', url: '/login' });
      expect(response.statusCode).toBe(200);
    });
  });
});
