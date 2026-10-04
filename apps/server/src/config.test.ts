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

  it('бэкапы: по умолчанию в 03:00 в data/backups, off — без расписания', () => {
    const config = loadConfig({ DATA_DIR: '/srv/webmotiv' });
    expect(config.backup).toEqual({
      dir: '/srv/webmotiv/backups',
      time: { hours: 3, minutes: 0 },
      keep: 14,
    });
    expect(loadConfig({ BACKUP_TIME: 'off' }).backup.time).toBeNull();
    expect(loadConfig({ BACKUP_TIME: '23:45' }).backup.time).toEqual({ hours: 23, minutes: 45 });
    expect(() => loadConfig({ BACKUP_TIME: '25:00' })).toThrow(/BACKUP_TIME/);
    expect(() => loadConfig({ BACKUP_TIME: '3 часа' })).toThrow(/BACKUP_TIME/);
  });
});
