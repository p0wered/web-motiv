// Хэширование паролей: scrypt из node:crypto (без нативных зависимостей).
// Формат: `scrypt$<N>$<r>$<p>$<соль base64>$<хэш base64>` — параметры хранятся в самом хэше,
// поэтому их можно усилить: старые хэши пересчитываются при следующем входе.
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

/** Рекомендация OWASP для scrypt: N=2^17, r=8, p=1 (~128 МБ памяти на одну проверку). */
export const OWASP_SCRYPT: ScryptParams = { N: 2 ** 17, r: 8, p: 1 };

const KEY_LENGTH = 64;

function scrypt(password: string, salt: Buffer, { N, r, p }: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, { N, r, p, maxmem: 256 * N * r }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

function parse(stored: string): { params: ScryptParams; salt: Buffer; hash: Buffer } | null {
  const [algorithm, n, r, p, salt, hash] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !hash) return null;
  const params = { N: Number(n), r: Number(r), p: Number(p) };
  if (!Object.values(params).every((value) => Number.isInteger(value) && value > 0)) return null;
  return { params, salt: Buffer.from(salt, 'base64'), hash: Buffer.from(hash, 'base64') };
}

export class PasswordHasher {
  private readonly params: ScryptParams;
  private dummyHash: Promise<string> | null = null;

  constructor(params: ScryptParams = OWASP_SCRYPT) {
    this.params = params;
  }

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const hash = await scrypt(password, salt, this.params);
    const { N, r, p } = this.params;
    return ['scrypt', N, r, p, salt.toString('base64'), hash.toString('base64')].join('$');
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const parsed = parse(stored);
    if (!parsed) return false;
    const actual = await scrypt(password, parsed.salt, parsed.params);
    return actual.length === parsed.hash.length && timingSafeEqual(actual, parsed.hash);
  }

  /** Хэш сделан с другими параметрами — пересчитать, пока пароль известен. */
  needsRehash(stored: string): boolean {
    const parsed = parse(stored);
    const { N, r, p } = this.params;
    return !parsed || parsed.params.N !== N || parsed.params.r !== r || parsed.params.p !== p;
  }

  /**
   * Проверка для несуществующего логина: та же работа, что и для настоящего, — по времени
   * ответа нельзя понять, есть ли такой сотрудник.
   */
  async verifyDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash('dummy password for timing');
    await this.verify(password, await this.dummyHash);
    return false;
  }
}
