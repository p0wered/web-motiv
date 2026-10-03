import { describe, expect, it } from 'vitest';
import { passwordProblem } from './password-policy.ts';

describe('passwordProblem', () => {
  it.each([
    'короткий',
    '123456789012',
    'qwerty123456',
    'aaaaaaaaaaaa',
    'abababababab',
    'qweqweqweqwe',
    'abcdefghijklmn',
    'йцукенгшщзхъ',
    '0987654321098',
    'Password2026!',
    'P@ssw0rd2026',
    'Пароль2026!!',
    'zaq12wsxcde3',
  ])('отклоняет слабый пароль %s', (password) => {
    expect(passwordProblem(password)).not.toBeNull();
  });

  it.each([
    'синий трамвай едет в депо',
    'correct horse battery staple',
    'k7#vR2pL9!mQ',
    'Мой кот любит рыбу 7 раз',
    'password manager for the whole team',
  ])('принимает нормальный пароль %s', (password) => {
    expect(passwordProblem(password)).toBeNull();
  });

  it('не принимает пароль с логином', () => {
    expect(passwordProblem('ivanov-secure-2026', { login: 'Ivanov' })).toBe(
      'Пароль не должен содержать логин',
    );
  });

  it('считает длину в символах, а не в байтах', () => {
    expect(passwordProblem('ёжик в тумане')).toBeNull();
    expect(passwordProblem('ёжик тумане')).toMatch(/Не короче 12/);
  });
});
