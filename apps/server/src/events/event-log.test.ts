import { describe, expect, it } from 'vitest';
import { openDb } from '../db/db.ts';
import { queryEvents, recordEvent } from './event-log.ts';

describe('queryEvents', () => {
  it('страницы от новых к старым и общее число по фильтру', () => {
    const db = openDb(':memory:');
    for (let i = 0; i < 7; i++) {
      recordEvent(db, {
        actorId: null,
        action: i % 2 === 0 ? 'auth.login_failed' : 'role.created',
        entityType: 'test',
        entityId: i,
      });
    }
    const first = queryEvents(db, { limit: 3 });
    expect(first.total).toBe(7);
    expect(first.items.map((event) => event.entityId)).toEqual(['6', '5', '4']);
    const last = queryEvents(db, { limit: 3, page: 3 });
    expect(last.items.map((event) => event.entityId)).toEqual(['0']);
    expect(queryEvents(db, { limit: 3, page: 4 }).items).toEqual([]);

    const auth = queryEvents(db, { limit: 3, page: 2, group: 'auth' });
    expect(auth.total).toBe(4);
    expect(auth.items.map((event) => event.entityId)).toEqual(['0']);
  });
});
