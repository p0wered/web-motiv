import type { AppConfig } from '../config.ts';

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    host: '127.0.0.1',
    port: 0,
    logLevel: 'silent',
    trustProxy: false,
    webDistDir: '/nonexistent',
    dataDir: '/nonexistent',
    ...overrides,
  };
}
