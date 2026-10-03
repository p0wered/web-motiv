import { describe, expect, it } from 'vitest';
import { stages } from '../db/schema.ts';
import { addUser, createTestApp, loginAs, type TestApp } from '../test-support/test-app.ts';

async function setup() {
  const t = await createTestApp();
  await addUser(t, { login: 'admin', roles: ['Администратор'] });
  const admin = await loginAs(t, 'admin');
  return { t, admin };
}

async function roleByName(t: TestApp, headers: Record<string, string>, name: string) {
  const list = (await t.app.inject({ url: '/api/roles', headers })).json();
  return list.find((role: { name: string }) => role.name === name);
}

describe('роли', () => {
  it('по умолчанию созданы шесть ролей', async () => {
    const { t, admin } = await setup();
    const list = (await t.app.inject({ url: '/api/roles', headers: admin })).json();
    expect(list.map((role: { name: string }) => role.name).sort()).toEqual(
      ['Администратор', 'Бухгалтер', 'Закупщик', 'Менеджер', 'Руководитель', 'Склад'].sort(),
    );
  });

  it('создание, дубликат названия, правка прав', async () => {
    const { t, admin } = await setup();
    const created = await t.app.inject({
      method: 'POST',
      url: '/api/roles',
      headers: admin,
      payload: { name: 'Логист', permissions: ['orders.view_all'] },
    });
    expect(created.statusCode).toBe(201);
    const duplicate = await t.app.inject({
      method: 'POST',
      url: '/api/roles',
      headers: admin,
      payload: { name: 'логист', permissions: [] },
    });
    expect(duplicate.json().fields.name).toBeDefined();

    const updated = await t.app.inject({
      method: 'PATCH',
      url: `/api/roles/${created.json().id}`,
      headers: admin,
      payload: { permissions: ['orders.view_all', 'orders.create'] },
    });
    expect(updated.json().permissions).toEqual(['orders.create', 'orders.view_all']);
  });

  it('новые права действуют сразу, без повторного входа', async () => {
    const { t, admin } = await setup();
    await addUser(t, { login: 'buh', roles: ['Бухгалтер'] });
    const buh = await loginAs(t, 'buh');
    expect((await t.app.inject({ url: '/api/events', headers: buh })).statusCode).toBe(403);
    const role = await roleByName(t, admin, 'Бухгалтер');
    await t.app.inject({
      method: 'PATCH',
      url: `/api/roles/${role.id}`,
      headers: admin,
      payload: { permissions: [...role.permissions, 'audit.view'] },
    });
    expect((await t.app.inject({ url: '/api/events', headers: buh })).statusCode).toBe(200);
  });

  it('у роли последнего администратора нельзя отнять права на сотрудников', async () => {
    const { t, admin } = await setup();
    const role = await roleByName(t, admin, 'Администратор');
    const response = await t.app.inject({
      method: 'PATCH',
      url: `/api/roles/${role.id}`,
      headers: admin,
      payload: { permissions: ['roles.manage'] },
    });
    expect(response.statusCode).toBe(409);
    const remove = await t.app.inject({
      method: 'DELETE',
      url: `/api/roles/${role.id}`,
      headers: admin,
    });
    expect(remove.statusCode).toBe(409);
  });

  it('роль-исполнителя этапов удалить нельзя', async () => {
    const { t, admin } = await setup();
    const role = await roleByName(t, admin, 'Склад');
    const now = new Date();
    t.db
      .insert(stages)
      .values({
        name: 'Отгрузка',
        executor: 'role',
        executorRoleId: role.id,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    const response = await t.app.inject({
      method: 'DELETE',
      url: `/api/roles/${role.id}`,
      headers: admin,
    });
    expect(response.statusCode).toBe(409);
  });

  it('удаление роли снимает её с сотрудников', async () => {
    const { t, admin } = await setup();
    await addUser(t, { login: 'buh', roles: ['Бухгалтер'] });
    const role = await roleByName(t, admin, 'Бухгалтер');
    const response = await t.app.inject({
      method: 'DELETE',
      url: `/api/roles/${role.id}`,
      headers: admin,
    });
    expect(response.statusCode).toBe(204);
    const buh = await loginAs(t, 'buh');
    expect((await t.app.inject({ url: '/api/auth/me', headers: buh })).json().roles).toEqual([]);
  });
});
