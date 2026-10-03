import { describe, expect, it } from 'vitest';
import { addUser, createTestApp, loginAs, type TestApp } from '../test-support/test-app.ts';

async function asAdmin(t: TestApp) {
  await addUser(t, { login: 'admin', roles: ['Администратор'] });
  return loginAs(t, 'admin');
}

function roleId(t: TestApp, name: string, headers: Record<string, string>) {
  return t.app
    .inject({ url: '/api/roles', headers })
    .then((r) => r.json().find((role: { name: string }) => role.name === name).id as number);
}

describe('сотрудники', () => {
  it('создание: временный пароль работает один раз — до смены', async () => {
    const t = await createTestApp();
    const admin = await asAdmin(t);
    const managerRole = await roleId(t, 'Менеджер', admin);
    const created = await t.app.inject({
      method: 'POST',
      url: '/api/users',
      headers: admin,
      payload: { login: 'ivanov', fullName: 'Иванов Иван', roleIds: [managerRole] },
    });
    expect(created.statusCode).toBe(201);
    const { user, temporaryPassword } = created.json();
    expect(user).toMatchObject({ login: 'ivanov', mustChangePassword: true });
    expect(temporaryPassword).toMatch(/^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/);

    const ivanov = await loginAs(t, 'ivanov', temporaryPassword);
    const me = (await t.app.inject({ url: '/api/auth/me', headers: ivanov })).json();
    expect(me).toMatchObject({ mustChangePassword: true, roles: [{ name: 'Менеджер' }] });
  });

  it('логин уникален без учёта регистра', async () => {
    const t = await createTestApp();
    const admin = await asAdmin(t);
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/users',
      headers: admin,
      payload: { login: 'ADMIN', fullName: 'Ещё один', roleIds: [] },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().fields.login).toBe('Логин уже занят');
  });

  it('лишние поля в запросе не принимаются', async () => {
    const t = await createTestApp();
    const admin = await asAdmin(t);
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/users',
      headers: admin,
      payload: { login: 'petrov', fullName: 'Петров', roleIds: [], isAdmin: true },
    });
    expect(response.statusCode).toBe(422);
  });

  it('блокировка завершает сеансы и закрывает вход', async () => {
    const t = await createTestApp();
    const admin = await asAdmin(t);
    const id = await addUser(t, { login: 'ivanov' });
    const ivanov = await loginAs(t, 'ivanov');
    const blocked = await t.app.inject({
      method: 'PATCH',
      url: `/api/users/${id}`,
      headers: admin,
      payload: { isActive: false },
    });
    expect(blocked.json()).toMatchObject({ isActive: false, activeSessions: 0 });
    expect((await t.app.inject({ url: '/api/auth/me', headers: ivanov })).statusCode).toBe(401);
  });

  it('сброс пароля: старый не работает, сеансы завершены', async () => {
    const t = await createTestApp();
    const admin = await asAdmin(t);
    const id = await addUser(t, { login: 'ivanov' });
    const ivanov = await loginAs(t, 'ivanov');
    const reset = await t.app.inject({
      method: 'POST',
      url: `/api/users/${id}/password-reset`,
      headers: admin,
    });
    const { temporaryPassword } = reset.json();
    expect((await t.app.inject({ url: '/api/auth/me', headers: ivanov })).statusCode).toBe(401);
    await expect(loginAs(t, 'ivanov')).rejects.toThrow(/422/);
    await loginAs(t, 'ivanov', temporaryPassword);
  });

  it('нельзя заблокировать себя', async () => {
    const t = await createTestApp();
    const admin = await asAdmin(t);
    const me = (await t.app.inject({ url: '/api/auth/me', headers: admin })).json();
    const response = await t.app.inject({
      method: 'PATCH',
      url: `/api/users/${me.id}`,
      headers: admin,
      payload: { isActive: false },
    });
    expect(response.statusCode).toBe(409);
  });

  it('нельзя снять роль с последнего администратора', async () => {
    const t = await createTestApp();
    const admin = await asAdmin(t);
    const me = (await t.app.inject({ url: '/api/auth/me', headers: admin })).json();
    const response = await t.app.inject({
      method: 'PATCH',
      url: `/api/users/${me.id}`,
      headers: admin,
      payload: { roleIds: [] },
    });
    expect(response.statusCode).toBe(409);
    const after = (await t.app.inject({ url: '/api/auth/me', headers: admin })).json();
    expect(after.roles).toEqual([{ id: expect.any(Number), name: 'Администратор' }]);
  });

  it('второго администратора можно лишить роли', async () => {
    const t = await createTestApp();
    const admin = await asAdmin(t);
    const second = await addUser(t, { login: 'second', roles: ['Администратор'] });
    const response = await t.app.inject({
      method: 'PATCH',
      url: `/api/users/${second}`,
      headers: admin,
      payload: { roleIds: [] },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().roles).toEqual([]);
  });

  it('изменения пишутся в журнал', async () => {
    const t = await createTestApp();
    const admin = await asAdmin(t);
    const id = await addUser(t, { login: 'ivanov' });
    await t.app.inject({
      method: 'PATCH',
      url: `/api/users/${id}`,
      headers: admin,
      payload: { fullName: 'Иванов И.И.' },
    });
    const events = (await t.app.inject({ url: '/api/events?group=user', headers: admin })).json();
    expect(events.items[0]).toMatchObject({
      action: 'user.updated',
      actor: { login: 'admin' },
      payload: { changes: { fullName: { from: 'Сотрудник ivanov', to: 'Иванов И.И.' } } },
    });
  });
});
