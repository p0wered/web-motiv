import { randomInt } from 'node:crypto';

// Без похожих символов (0/O, 1/l/I): пароль диктуют или переписывают с экрана.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Временный пароль: 4 группы по 4 символа (≈79 бит), например `k7mp-x3qa-9rtw-bn4e`. */
export function generateTemporaryPassword(): string {
  const groups = Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''),
  );
  return groups.join('-');
}
