import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.ts';

describe('loadConfig', () => {
  it('по умолчанию не доверяет X-Forwarded-For', () => {
    expect(loadConfig({}).trustProxy).toBe(false);
    expect(loadConfig({ TRUST_PROXY: '' }).trustProxy).toBe(false);
    expect(loadConfig({ TRUST_PROXY: 'false' }).trustProxy).toBe(false);
  });

  it('принимает список адресов прокси', () => {
    expect(loadConfig({ TRUST_PROXY: '172.17.0.1, 10.0.0.0/8' }).trustProxy).toEqual([
      '172.17.0.1',
      '10.0.0.0/8',
    ]);
  });

  it('не принимает TRUST_PROXY=true', () => {
    expect(() => loadConfig({ TRUST_PROXY: 'true' })).toThrow(/TRUST_PROXY/);
  });

  it('проверяет порт', () => {
    expect(() => loadConfig({ PORT: '70000' })).toThrow(/PORT/);
  });
});
