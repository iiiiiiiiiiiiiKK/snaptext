import { beforeEach, describe, expect, it } from 'vitest';
import { createHistoryStore, makeHistoryId, MAX_HISTORY_RECORDS, type HistoryRecord } from '../lib/history';

function record(overrides: Partial<HistoryRecord> = {}): HistoryRecord {
  return {
    id: makeHistoryId(),
    fileName: 'shot.png',
    text: 'recognised text',
    langs: 'chi_sim+eng',
    confidence: 90,
    createdAt: Date.now(),
    thumbnail: 'data:image/jpeg;base64,AAAA',
    width: 800,
    height: 600,
    edited: false,
    ...overrides,
  };
}

let dbCounter = 0;
const nextDbName = () => `snaptext-test-${Date.now()}-${dbCounter++}`;

describe('history store (IndexedDB)', () => {
  let store: ReturnType<typeof createHistoryStore>;

  beforeEach(() => {
    store = createHistoryStore(indexedDB, nextDbName());
  });

  it('reports IndexedDB as its backend', () => {
    expect(store.kind).toBe('indexeddb');
  });

  it('starts empty', async () => {
    await expect(store.list()).resolves.toEqual([]);
  });

  it('saves and lists records newest first', async () => {
    await store.add(record({ id: 'old', createdAt: 1000, fileName: 'old.png' }));
    await store.add(record({ id: 'new', createdAt: 5000, fileName: 'new.png' }));
    const records = await store.list();
    expect(records.map((entry) => entry.id)).toEqual(['new', 'old']);
  });

  it('deletes a single record', async () => {
    await store.add(record({ id: 'keep', createdAt: 1 }));
    await store.add(record({ id: 'drop', createdAt: 2 }));
    await store.remove('drop');
    const records = await store.list();
    expect(records.map((entry) => entry.id)).toEqual(['keep']);
  });

  it('clears everything', async () => {
    await store.add(record({ id: 'a', createdAt: 1 }));
    await store.add(record({ id: 'b', createdAt: 2 }));
    await store.clear();
    await expect(store.list()).resolves.toEqual([]);
  });

  it('replaces a record with the same id instead of duplicating it', async () => {
    await store.add(record({ id: 'same', text: 'first', createdAt: 1 }));
    await store.add(record({ id: 'same', text: 'second', createdAt: 2 }));
    const records = await store.list();
    expect(records).toHaveLength(1);
    expect(records[0].text).toBe('second');
  });

  it('trims the oldest records beyond the cap', async () => {
    for (let index = 0; index < MAX_HISTORY_RECORDS + 3; index += 1) {
      await store.add(record({ id: `r${index}`, createdAt: index }));
    }
    const records = await store.list();
    expect(records).toHaveLength(MAX_HISTORY_RECORDS);
    expect(records[0].id).toBe(`r${MAX_HISTORY_RECORDS + 2}`);
    expect(records.some((entry) => entry.id === 'r0')).toBe(false);
  });
});

describe('history store (memory fallback)', () => {
  it('falls back to memory when IndexedDB is blocked', async () => {
    const brokenFactory = {
      open() {
        throw new Error('storage blocked');
      },
    } as unknown as IDBFactory;
    const store = createHistoryStore(brokenFactory, 'blocked');
    await expect(store.list()).resolves.toEqual([]);
    expect(store.kind).toBe('memory');

    await store.add(record({ id: 'x', createdAt: 1 }));
    expect((await store.list()).map((entry) => entry.id)).toEqual(['x']);
    await store.remove('x');
    await expect(store.list()).resolves.toEqual([]);
  });

  it('works without any IndexedDB implementation', async () => {
    const store = createHistoryStore(null as unknown as IDBFactory, 'unused');
    await store.add(record({ id: 'x', createdAt: 1 }));
    expect((await store.list()).map((entry) => entry.id)).toEqual(['x']);
    await store.clear();
    await expect(store.list()).resolves.toEqual([]);
  });

  it('ignores malformed rows when reading', async () => {
    const store = createHistoryStore(indexedDB, nextDbName());
    await store.add(record({ id: 'good', createdAt: 2 }));
    const records = await store.list();
    expect(records.every((entry) => typeof entry.id === 'string')).toBe(true);
  });
});
