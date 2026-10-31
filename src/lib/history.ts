import type { LangKey } from './types';
import { isLangKey } from './types';

export interface HistoryRecord {
  id: string;
  fileName: string;
  text: string;
  langs: LangKey;
  confidence: number | null;
  createdAt: number;
  /** Small JPEG data URL. Full images are never stored. */
  thumbnail: string | null;
  width: number;
  height: number;
  edited: boolean;
}

export interface HistoryStore {
  readonly kind: 'indexeddb' | 'memory';
  list(): Promise<HistoryRecord[]>;
  add(record: HistoryRecord): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export const MAX_HISTORY_RECORDS = 60;

const DB_VERSION = 1;
const STORE_NAME = 'records';

function sortNewestFirst(records: HistoryRecord[]): HistoryRecord[] {
  return [...records].sort((a, b) => b.createdAt - a.createdAt);
}

class MemoryHistoryStore implements HistoryStore {
  readonly kind = 'memory' as const;
  private records: HistoryRecord[] = [];

  async list(): Promise<HistoryRecord[]> {
    return sortNewestFirst(this.records);
  }

  async add(record: HistoryRecord): Promise<void> {
    this.records = sortNewestFirst([record, ...this.records.filter((r) => r.id !== record.id)]).slice(
      0,
      MAX_HISTORY_RECORDS,
    );
  }

  async remove(id: string): Promise<void> {
    this.records = this.records.filter((record) => record.id !== id);
  }

  async clear(): Promise<void> {
    this.records = [];
  }
}

class IndexedDbHistoryStore implements HistoryStore {
  readonly kind = 'indexeddb' as const;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly factory: IDBFactory,
    private readonly dbName: string,
  ) {}

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = this.factory.open(this.dbName, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('createdAt', 'createdAt');
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('indexeddb open failed'));
        request.onblocked = () => reject(new Error('indexeddb blocked'));
      });
    }
    return this.dbPromise;
  }

  private async tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = run(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('indexeddb request failed'));
    });
  }

  async list(): Promise<HistoryRecord[]> {
    const rows = await this.tx<HistoryRecord[]>('readonly', (store) => store.getAll() as IDBRequest<HistoryRecord[]>);
    return sortNewestFirst(rows.filter(isHistoryRecord));
  }

  async add(record: HistoryRecord): Promise<void> {
    await this.tx('readwrite', (store) => store.put(record));
    const rows = await this.list();
    const overflow = rows.slice(MAX_HISTORY_RECORDS);
    for (const old of overflow) await this.remove(old.id);
  }

  async remove(id: string): Promise<void> {
    await this.tx('readwrite', (store) => store.delete(id));
  }

  async clear(): Promise<void> {
    await this.tx('readwrite', (store) => store.clear());
  }
}

function isHistoryRecord(value: unknown): value is HistoryRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<HistoryRecord>;
  return (
    typeof record.id === 'string' &&
    typeof record.fileName === 'string' &&
    typeof record.text === 'string' &&
    typeof record.createdAt === 'number' &&
    isLangKey(record.langs)
  );
}

/**
 * History lives in IndexedDB. If IndexedDB is unavailable (private mode, blocked
 * storage) the store degrades to an in-memory list for the current session and
 * reports `kind: 'memory'` so the UI can warn the user.
 */
export function createHistoryStore(
  factory: IDBFactory | undefined = typeof indexedDB !== 'undefined' ? indexedDB : undefined,
  dbName = 'snaptext',
): HistoryStore {
  if (!factory) return new MemoryHistoryStore();

  const idb = new IndexedDbHistoryStore(factory, dbName);
  const memory = new MemoryHistoryStore();
  let fallback = false;

  const guard = async <T>(operation: () => Promise<T>, mock: () => Promise<T>): Promise<T> => {
    if (fallback) return mock();
    try {
      return await operation();
    } catch (error) {
      fallback = true;
      console.warn('[snaptext] IndexedDB unavailable, falling back to in-memory history', error);
      return mock();
    }
  };

  return {
    get kind() {
      return fallback ? ('memory' as const) : ('indexeddb' as const);
    },
    list: () => guard(() => idb.list(), () => memory.list()),
    add: (record) => guard(() => idb.add(record), () => memory.add(record)),
    remove: (id) => guard(() => idb.remove(id), () => memory.remove(id)),
    clear: () => guard(() => idb.clear(), () => memory.clear()),
  };
}

export function makeHistoryId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
