// Матрица доступа (PLAN.md §7.2): каждый маршрут API × роль → пускает или нет.
// Новый маршрут без строки здесь роняет первый тест — доступ нужно продумать явно.
import { describe, expect, it } from 'vitest';
import { addUser, createTestApp, CSRF, loginAs, type TestApp } from '../test-support/test-app.ts';
import type { Access } from './access.ts';

interface Case {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  url: string;
  /** Как маршрут объявлен (для сверки с реестром). */
  route: string;
  access: Access;
  payload?: Record<string, unknown>;
}

const SESSION_ID = 'a'.repeat(64);

const CASES: Case[] = [
  { method: 'GET', url: '/api/health', route: '/api/health', access: 'public' },
  { method: 'POST', url: '/api/auth/login', route: '/api/auth/login', access: 'public' },
  { method: 'POST', url: '/api/auth/logout', route: '/api/auth/logout', access: 'authenticated' },
  { method: 'GET', url: '/api/auth/me', route: '/api/auth/me', access: 'authenticated' },
  {
    method: 'POST',
    url: '/api/auth/password',
    route: '/api/auth/password',
    access: 'authenticated',
  },
  {
    method: 'GET',
    url: '/api/auth/sessions',
    route: '/api/auth/sessions',
    access: 'authenticated',
  },
  {
    method: 'DELETE',
    url: `/api/auth/sessions/${SESSION_ID}`,
    route: '/api/auth/sessions/:id',
    access: 'authenticated',
  },
  {
    method: 'DELETE',
    url: '/api/auth/sessions',
    route: '/api/auth/sessions',
    access: 'authenticated',
  },
  { method: 'GET', url: '/api/users', route: '/api/users', access: 'users.manage' },
  { method: 'POST', url: '/api/users', route: '/api/users', access: 'users.manage', payload: {} },
  { method: 'GET', url: '/api/users/1', route: '/api/users/:id', access: 'users.manage' },
  {
    method: 'PATCH',
    url: '/api/users/1',
    route: '/api/users/:id',
    access: 'users.manage',
    payload: {},
  },
  {
    method: 'POST',
    url: '/api/users/1/password-reset',
    route: '/api/users/:id/password-reset',
    access: 'users.manage',
  },
  {
    method: 'DELETE',
    url: '/api/users/1/sessions',
    route: '/api/users/:id/sessions',
    access: 'users.manage',
  },
  {
    method: 'GET',
    url: '/api/roles',
    route: '/api/roles',
    access: ['roles.manage', 'users.manage', 'templates.manage'],
  },
  { method: 'POST', url: '/api/roles', route: '/api/roles', access: 'roles.manage', payload: {} },
  {
    method: 'PATCH',
    url: '/api/roles/999',
    route: '/api/roles/:id',
    access: 'roles.manage',
    payload: {},
  },
  { method: 'DELETE', url: '/api/roles/999', route: '/api/roles/:id', access: 'roles.manage' },
  { method: 'GET', url: '/api/events', route: '/api/events', access: 'audit.view' },
  { method: 'GET', url: '/api/stages', route: '/api/stages', access: 'templates.manage' },
  {
    method: 'POST',
    url: '/api/stages',
    route: '/api/stages',
    access: 'templates.manage',
    payload: {},
  },
  { method: 'GET', url: '/api/stages/999', route: '/api/stages/:id', access: 'templates.manage' },
  {
    method: 'PATCH',
    url: '/api/stages/999',
    route: '/api/stages/:id',
    access: 'templates.manage',
    payload: {},
  },
  {
    method: 'DELETE',
    url: '/api/stages/999',
    route: '/api/stages/:id',
    access: 'templates.manage',
  },
  { method: 'GET', url: '/api/templates', route: '/api/templates', access: 'templates.manage' },
  {
    method: 'POST',
    url: '/api/templates',
    route: '/api/templates',
    access: 'templates.manage',
    payload: {},
  },
  {
    method: 'GET',
    url: '/api/templates/999',
    route: '/api/templates/:id',
    access: 'templates.manage',
  },
  {
    method: 'PATCH',
    url: '/api/templates/999',
    route: '/api/templates/:id',
    access: 'templates.manage',
    payload: {},
  },
  {
    method: 'DELETE',
    url: '/api/templates/999',
    route: '/api/templates/:id',
    access: 'templates.manage',
  },
];

/** Роль по умолчанию → ожидаемые права (см. bootstrap.ts). */
const ROLES: Record<string, string[]> = {
  Администратор: ['users.manage', 'roles.manage', 'audit.view', 'templates.manage'],
  Руководитель: ['audit.view', 'templates.manage'],
  Менеджер: [],
  Склад: [],
};

function allowed(access: Access, permissions: string[]): boolean {
  if (access === 'public' || access === 'authenticated') return true;
  const required: readonly string[] = typeof access === 'string' ? [access] : access;
  return required.some((permission) => permissions.includes(permission));
}

async function call(t: TestApp, item: Case, headers: Record<string, string>) {
  return t.app.inject({
    method: item.method,
    url: item.url,
    headers,
    ...(item.payload !== undefined ? { payload: item.payload } : {}),
  });
}

describe('матрица доступа', () => {
  it('описывает каждый маршрут API ровно так, как он объявлен', async () => {
    const { app } = await createTestApp();
    const declared = app.apiRoutes.map((r) => ({ method: r.method, url: r.url, access: r.access }));
    const described = CASES.map((c) => ({ method: c.method, url: c.route, access: c.access }));
    const key = (r: { method: string; url: string }) => `${r.method} ${r.url}`;
    expect([...declared].sort((a, b) => key(a).localeCompare(key(b)))).toEqual(
      [...described].sort((a, b) => key(a).localeCompare(key(b))),
    );
  });

  it('без входа открыты только публичные маршруты', async () => {
    const t = await createTestApp();
    for (const item of CASES) {
      const response = await call(t, item, CSRF);
      if (item.access === 'public') expect(response.statusCode, item.url).not.toBe(401);
      else expect(response.statusCode, `${item.method} ${item.url}`).toBe(401);
    }
  });

  for (const [role, permissions] of Object.entries(ROLES)) {
    it(`роль «${role}»`, async () => {
      const t = await createTestApp();
      await addUser(t, { login: 'subject', roles: [role] });
      for (const item of CASES) {
        if (item.url === '/api/auth/logout') continue;
        const headers = await loginAs(t, 'subject');
        const response = await call(t, item, headers);
        const label = `${role}: ${item.method} ${item.url} → ${response.statusCode}`;
        if (allowed(item.access, permissions)) {
          expect([401, 403], label).not.toContain(response.statusCode);
        } else {
          expect(response.statusCode, label).toBe(403);
        }
      }
    });
  }
});
