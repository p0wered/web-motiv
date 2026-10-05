import { describe, expect, it } from 'vitest';
import { pageForSize, pageItems } from './pagination.tsx';

describe('pageItems', () => {
  it('мало страниц — все подряд', () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('много страниц — первая, последняя и соседи текущей; ряд всегда из 7', () => {
    expect(pageItems(1, 20)).toEqual([1, 2, 3, 4, 5, 'gap', 20]);
    expect(pageItems(4, 20)).toEqual([1, 2, 3, 4, 5, 'gap', 20]);
    expect(pageItems(5, 20)).toEqual([1, 'gap', 4, 5, 6, 'gap', 20]);
    expect(pageItems(17, 20)).toEqual([1, 'gap', 16, 17, 18, 19, 20]);
    expect(pageItems(20, 20)).toEqual([1, 'gap', 16, 17, 18, 19, 20]);
  });
});

describe('pageForSize', () => {
  it('та же верхняя строка при другом размере страницы', () => {
    expect(pageForSize(1, 50, 25)).toBe(1);
    expect(pageForSize(3, 50, 25)).toBe(5); // строка 101
    expect(pageForSize(3, 50, 100)).toBe(2); // строка 101 — на второй сотне
    expect(pageForSize(4, 25, 100)).toBe(1); // строка 76
  });
});
