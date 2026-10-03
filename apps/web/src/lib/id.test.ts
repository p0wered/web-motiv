import { afterEach, describe, expect, it } from 'vitest';
import { newId } from './id.ts';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const original = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(crypto), 'randomUUID');

describe('newId', () => {
  afterEach(() => {
    delete (crypto as { randomUUID?: unknown }).randomUUID;
  });

  it('без crypto.randomUUID (HTTP в локальной сети) — тоже UUID v4', () => {
    expect(original).toBeDefined();
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    const ids = new Set(Array.from({ length: 100 }, newId));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });
});
