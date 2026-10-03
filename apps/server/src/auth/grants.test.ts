import { describe, expect, it } from 'vitest';
import { addUser, createTestApp, loginAs, type TestApp } from '../test-support/test-app.ts';

/** Роль с правами через API администратора; возвращает id. */
async function createRole(
  t: TestApp,
  admin: Record<string, string>,
  name: string,
  permissions: string[],
) {
  const response = await t.app.inject({
    method: 'POST',
    url: '/api/roles',
    headers: admin,
    payload: { name, permissions },
  });
  return response.json().id as number;
}

async function roleId(t: TestApp, headers: Record<string, string>, name: string) {
  const list = (await t.app.inject({ url: '/api/roles', headers })).json();
  return list.find((role: { name: string }) => role.name === name).id as number;
}

describe('нельзя выдать права, которых нет у себя', () => {
  it('кадровик не назначает себе роль администратора', async () => {
    const t = await createTestApp();
    await addUser(t, { login: 'admin', roles: ['Администратор'] });
    const admin = await loginAs(t, 'admin');
    await createRole(t, admin, 'Кадровик', ['users.manage']);
    const hrId = await addUser(t, { login: 'hr', roles: ['Кадровик'] });
    const hr = await loginAs(t, 'hr');
    const adminRole = await roleId(t, hr, 'Администратор');
    const hrRole = await roleId(t, hr, 'Кадровик');

    const escalate = await t.app.inject({
      method: 'PATCH',
      url: `/api/users/${hrId}`,
      headers: hr,
      payload: { roleIds: [hrRole, adminRole] },
    });
    expect(escalate.statusCode).toBe(403);
    expect(escalate.json().error).toMatch(/Администратор/);

    const withManager = await t.app.inject({
      method: 'POST',
      url: '/api/users',
      headers: hr,
      payload: { login: 'newbie', fullName: 'Новичок', roleIds: [await roleId(t, hr, 'Менеджер')] },
    });
    expect(withManager.statusCode).toBe(403);

    const plain = await t.app.inject({
      method: 'POST',
      url: '/api/users',
      headers: hr,
      payload: { login: 'newbie', fullName: 'Новичок', roleIds: [hrRole] },
    });
    expect(plain.statusCode).toBe(201);
  });

  it('кадровик не снимает роль администратора с другого', async () => {
    const t = await createTestApp();
    await addUser(t, { login: 'admin', roles: ['Администратор'] });
    const admin = await loginAs(t, 'admin');
    await createRole(t, admin, 'Кадровик', ['users.manage']);
    const second = await addUser(t, { login: 'second', roles: ['Администратор'] });
    await addUser(t, { login: 'hr', roles: ['Кадровик'] });
    const hr = await loginAs(t, 'hr');
    const response = await t.app.inject({
      method: 'PATCH',
      url: `/api/users/${second}`,
      headers: hr,
      payload: { roleIds: [] },
    });
    expect(response.statusCode).toBe(403);
  });

  it('с правом на роли нельзя добавить своей роли чужие права', async () => {
    const t = await createTestApp();
    await addUser(t, { login: 'admin', roles: ['Администратор'] });
    const admin = await loginAs(t, 'admin');
    const ownRole = await createRole(t, admin, 'Настройщик ролей', ['roles.manage']);
    await addUser(t, { login: 'rm', roles: ['Настройщик ролей'] });
    const rm = await loginAs(t, 'rm');

    const escalate = await t.app.inject({
      method: 'PATCH',
      url: `/api/roles/${ownRole}`,
      headers: rm,
      payload: { permissions: ['roles.manage', 'users.manage'] },
    });
    expect(escalate.statusCode).toBe(403);

    const create = await t.app.inject({
      method: 'POST',
      url: '/api/roles',
      headers: rm,
      payload: { name: 'Аудитор', permissions: ['audit.view'] },
    });
    expect(create.statusCode).toBe(403);

    const allowed = await t.app.inject({
      method: 'POST',
      url: '/api/roles',
      headers: rm,
      payload: { name: 'Помощник', permissions: ['roles.manage'] },
    });
    expect(allowed.statusCode).toBe(201);

    const removeAdmin = await t.app.inject({
      method: 'DELETE',
      url: `/api/roles/${await roleId(t, rm, 'Администратор')}`,
      headers: rm,
    });
    expect(removeAdmin.statusCode).toBe(403);
  });
});
