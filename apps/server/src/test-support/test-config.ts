import type { AppConfig } from '../config.ts';

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    host: '127.0.0.1',
    port: 0,
    logLevel: 'silent',
    trustProxy: false,
    webDistDir: '/nonexistent',
    dataDir: '/nonexistent',
    session: { idleMs: 2 * 3_600_000, absoluteMs: 12 * 3_600_000 },
    cookieSecure: false,
    initialAdmin: null,
    ...overrides,
  };
}
