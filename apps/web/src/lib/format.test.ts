import { describe, expect, it } from 'vitest';
import { describeUserAgent, formatDateTime, initials } from './format.ts';

describe('formatDateTime', () => {
  const now = new Date(2026, 9, 5, 15, 0);
  it('сегодня, вчера и раньше', () => {
    expect(formatDateTime(new Date(2026, 9, 5, 10, 15).toISOString(), now)).toBe('сегодня в 10:15');
    expect(formatDateTime(new Date(2026, 9, 4, 18, 2).toISOString(), now)).toBe('вчера в 18:02');
    expect(formatDateTime(new Date(2026, 9, 1, 9, 0).toISOString(), now)).toMatch(/1 окт/);
    expect(formatDateTime(new Date(2025, 0, 1, 9, 0).toISOString(), now)).toMatch(/2025/);
  });
});

describe('describeUserAgent', () => {
  it('узнаёт браузер и систему', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
      ),
    ).toBe('Chrome, Windows');
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      ),
    ).toBe('Safari, macOS');
    expect(describeUserAgent(null)).toBe('Неизвестное устройство');
  });
});

describe('initials', () => {
  it('две первые буквы', () => {
    expect(initials('Иванов Иван Иванович')).toBe('ИИ');
    expect(initials('admin')).toBe('A');
  });
});

describe('formatDate, formatFileSize', () => {
  it('дата словами и размер файла', async () => {
    const { formatDate, formatFileSize } = await import('./format.ts');
    expect(formatDate('2026-10-04')).toMatch(/4 октября 2026/);
    expect(formatFileSize(512)).toBe('512 Б');
    expect(formatFileSize(1536)).toBe('1,5 КБ');
    expect(formatFileSize(25 * 1024 * 1024)).toBe('25 МБ');
  });
});
