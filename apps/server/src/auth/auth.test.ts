import { PASSWORD_CHANGE_REQUIRED } from '@webmotiv/shared';
import { describe, expect, it } from 'vitest';
import {
  addUser,
  createTestApp,
  CSRF,
  loginAs,
  STRONG_PASSWORD,
  type TestApp,
} from '../test-support/test-app.ts';

async function login(t: TestApp, login: string, password: string, ip = '127.0.0.1') {
  return t.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: CSRF,
    remoteAddress: ip,
    payload: { login, password },
  });
}

describe('вход', () => {
  it('ставит cookie HttpOnly + SameSite=Strict и отдаёт сотрудника', async () => {
    const t = await createTestApp();
    await addUser(t, { login: 'ivanov', roles: ['Менеджер'] });
    const response = await login(t, 'IVANOV', STRONG_PASSWORD);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      login: 'ivanov',
      mustChangePassword: false,
      permissions: expect.arrayContaining(['orders.create']),
    });
    const cookie = response.cookies[0];
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/' });
    expect(cookie?.value).toMatch(/^[\w-]{43}$/);
  });

  it('за HTTPS-прокси ставит cookie __Host- с Secure', async () => {
    const t = await createTestApp({ cookieSecure: 'auto', trustProxy: ['127.0.0.1'] });
    await addUser(t, { login: 'ivanov' });
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { ...CSRF, 'x-forwarded-proto': 'https' },
      payload: { login: 'ivanov', password: STRONG_PASSWORD },
    });
    expect(response.cookies[0]).toMatchObject({ name: '__Host-webmotiv_session', secure: true });
  });

  it('неизвестный логин и неверный пароль неотличимы', async () => {
    const t = await createTestApp();
    await addUser(t, { login: 'ivanov' });
    const wrongPassword = await login(t, 'ivanov', 'не тот пароль совсем');
    const unknownLogin = await login(t, 'nobody', 'не тот пароль совсем');
    expect(wrongPassword.statusCode).toBe(422);
    expect(unknownLogin.statusCode).toBe(422);
    expect(wrongPassword.json()).toEqual(unknownLogin.json());
  });

  it('после 5 ошибок по логину — пауза, другие логины с того же IP входят', async () => {
    const t = await createTestApp();
    await addUser(t, { login: 'ivanov' });
    await addUser(t, { login: 'petrov' });
    for (let i = 0; i < 5; i++) {
      expect((await login(t, 'ivanov', `неверный пароль ${i}`)).statusCode).toBe(422);
    }
    expect((await login(t, 'ivanov', 'неверный пароль 6')).statusCode).toBe(422);
    const blocked = await login(t, 'ivanov', STRONG_PASSWORD);
    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect((await login(t, 'petrov', STRONG_PASSWORD)).statusCode).toBe(200);
  });

  it('с одного IP перебор разных логинов упирается в лимит IP', async () => {
    const t = await createTestApp();
    await addUser(t, { login: 'ivanov' });
    for (let i = 0; i < 21; i++) await login(t, `user${i}`, 'неверный пароль', '10.0.0.9');
    expect((await login(t, 'ivanov', STRONG_PASSWORD, '10.0.0.9')).statusCode).toBe(429);
    expect((await login(t, 'ivanov', STRONG_PASSWORD, '10.0.0.10')).statusCode).toBe(200);
  });

  it('заблокированный сотрудник не входит', async () => {
    const t = await createTestApp();
    await addUser(t, { login: 'ivanov', isActive: false });
    const response = await login(t, 'ivanov', STRONG_PASSWORD);
    expect(response.statusCode).toBe(403);
    expect(response.cookies).toHaveLength(0);
  });

  it('без cookie — 401, с испорченной — 401', async () => {
    const t = await createTestApp();
    expect((await t.app.inject({ url: '/api/auth/me' })).statusCode).toBe(401);
    const response = await t.app.inject({
      url: '/api/auth/me',
      headers: { cookie: 'webmotiv_session=forged' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('выход завершает сеанс', async () => {
    const t = await createTestApp();
    await addUser(t, { login: 'ivanov' });
    const headers = await loginAs(t, 'ivanov');
    const logout = await t.app.inject({ method: 'POST', url: '/api/auth/logout', headers });
    expect(logout.statusCode).toBe(204);
    expect((await t.app.inject({ url: '/api/auth/me', headers })).statusCode).toBe(401);
  });

  it('пишет входы в журнал', async () => {
    const t = await createTestApp();
    await addUser(t, { login: 'admin', roles: ['Администратор'] });
    await login(t, 'admin', 'неверный пароль совсем');
    const headers = await loginAs(t, 'admin');
    const response = await t.app.inject({ url: '/api/events?group=auth', headers });
    const actions = response.json().items.map((item: { action: string }) => item.action);
    expect(actions).toEqual(['auth.login_succeeded', 'auth.login_failed']);
  });
});

describe('временный пароль', () => {
  it('пока не сменён, остальное API закрыто', async () => {
    const t = await createTestApp();
    await addUser(t, { login: 'admin', roles: ['Администратор'], mustChangePassword: true });
    const headers = await loginAs(t, 'admin');

    const blocked = await t.app.inject({ url: '/api/users', headers });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().code).toBe(PASSWORD_CHANGE_REQUIRED);

    const weak = await t.app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers,
      payload: { password: 'qwerty123456', confirmation: 'qwerty123456' },
    });
    expect(weak.statusCode).toBe(422);
    expect(weak.json().fields.password).toBeDefined();

    const newPassword = 'зелёный слон идёт домой';
    const changed = await t.app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers,
      payload: { password: newPassword, confirmation: newPassword },
    });
    expect(changed.statusCode).toBe(204);
    expect((await t.app.inject({ url: '/api/users', headers })).statusCode).toBe(200);
  });
});

describe('смена пароля', () => {
  it('требует текущий пароль и завершает остальные сеансы', async () => {
    const t = await createTestApp();
    await addUser(t, { login: 'ivanov' });
    const here = await loginAs(t, 'ivanov');
    const elsewhere = await loginAs(t, 'ivanov');
    const newPassword = 'зелёный слон идёт домой';

    const noCurrent = await t.app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: here,
      payload: { password: newPassword, confirmation: newPassword },
    });
    expect(noCurrent.json().fields.current).toBeDefined();

    const changed = await t.app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: here,
      payload: { current: STRONG_PASSWORD, password: newPassword, confirmation: newPassword },
    });
    expect(changed.statusCode).toBe(204);
    expect((await t.app.inject({ url: '/api/auth/me', headers: here })).statusCode).toBe(200);
    expect((await t.app.inject({ url: '/api/auth/me', headers: elsewhere })).statusCode).toBe(401);
  });
});

describe('свои сеансы', () => {
  it('видны списком, можно завершить остальные', async () => {
    const t = await createTestApp();
    await addUser(t, { login: 'ivanov' });
    const here = await loginAs(t, 'ivanov');
    const elsewhere = await loginAs(t, 'ivanov');
    const list = (await t.app.inject({ url: '/api/auth/sessions', headers: here })).json();
    expect(list).toHaveLength(2);
    expect(list.filter((session: { current: boolean }) => session.current)).toHaveLength(1);

    await t.app.inject({ method: 'DELETE', url: '/api/auth/sessions', headers: here });
    expect((await t.app.inject({ url: '/api/auth/me', headers: here })).statusCode).toBe(200);
    expect((await t.app.inject({ url: '/api/auth/me', headers: elsewhere })).statusCode).toBe(401);
  });

  it('чужой сеанс завершить нельзя', async () => {
    const t = await createTestApp();
    await addUser(t, { login: 'ivanov' });
    await addUser(t, { login: 'petrov' });
    const ivanov = await loginAs(t, 'ivanov');
    const petrov = await loginAs(t, 'petrov');
    const [session] = (await t.app.inject({ url: '/api/auth/sessions', headers: petrov })).json();
    const response = await t.app.inject({
      method: 'DELETE',
      url: `/api/auth/sessions/${session.id}`,
      headers: ivanov,
    });
    expect(response.statusCode).toBe(404);
    expect((await t.app.inject({ url: '/api/auth/me', headers: petrov })).statusCode).toBe(200);
  });
});
