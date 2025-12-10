/**
 * D1SyncStateStore Tests
 *
 * Uses a mock D1Database implementation for testing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { D1SyncStateStore, type D1Database, type D1PreparedStatement, type D1Result } from './d1-store.js';
import type { CardSyncState, PlatformId } from './types.js';

/**
 * In-memory D1 mock for testing
 * Simulates basic D1 behavior without actual SQLite
 */
function createMockD1(): D1Database & { _data: Map<string, CardSyncState> } {
  const data = new Map<string, CardSyncState>();

  const createPrepared = (query: string): D1PreparedStatement => {
    let boundValues: unknown[] = [];

    const prepared: D1PreparedStatement = {
      bind(...values: unknown[]): D1PreparedStatement {
        boundValues = values;
        return prepared;
      },
      async first<T = unknown>(_column?: string): Promise<T | null> {
        // SELECT by federated_id
        if (query.includes('WHERE federated_id = ?')) {
          const id = boundValues[0] as string;
          const state = data.get(id);
          if (!state) return null;
          return stateToRow(state) as T;
        }
        // SELECT by local_id
        if (query.includes('WHERE local_id = ?')) {
          const localId = boundValues[0] as string;
          for (const state of data.values()) {
            if (state.localId === localId) {
              return stateToRow(state) as T;
            }
          }
          return null;
        }
        // SELECT by platform_ids JSON
        if (query.includes('json_extract(platform_ids')) {
          const path = boundValues[0] as string;
          const platformId = boundValues[1] as string;
          const platform = path.replace('$.', '') as PlatformId;
          for (const state of data.values()) {
            if (state.platformIds[platform] === platformId) {
              return stateToRow(state) as T;
            }
          }
          return null;
        }
        // COUNT
        if (query.includes('COUNT(*)')) {
          return { count: data.size } as T;
        }
        return null;
      },
      async run(): Promise<D1Result> {
        // INSERT / UPDATE
        if (query.includes('INSERT INTO')) {
          const state: CardSyncState = {
            federatedId: boundValues[0] as string,
            localId: boundValues[1] as string,
            platformIds: JSON.parse(boundValues[2] as string),
            lastSync: JSON.parse(boundValues[3] as string),
            versionHash: boundValues[4] as string,
            status: boundValues[5] as CardSyncState['status'],
            conflict: boundValues[6] ? JSON.parse(boundValues[6] as string) : undefined,
          };
          data.set(state.federatedId, state);
        }
        // DELETE
        if (query.includes('DELETE') && query.includes('WHERE federated_id = ?')) {
          data.delete(boundValues[0] as string);
        }
        // DELETE all
        if (query.includes('DELETE') && !query.includes('WHERE')) {
          data.clear();
        }
        return {
          results: [],
          success: true,
          meta: { duration: 0, changes: 1, last_row_id: 0 },
        };
      },
      async all<T = unknown>(): Promise<D1Result<T>> {
        let results: unknown[] = [];
        // SELECT all
        if (query.includes('SELECT *') && !query.includes('WHERE')) {
          results = Array.from(data.values()).map(stateToRow);
        }
        // SELECT by status
        if (query.includes('WHERE status = ?')) {
          const status = boundValues[0] as string;
          results = Array.from(data.values())
            .filter((s) => s.status === status)
            .map(stateToRow);
        }
        return {
          results: results as T[],
          success: true,
          meta: { duration: 0, changes: 0, last_row_id: 0 },
        };
      },
    };

    return prepared;
  };

  return {
    _data: data,
    prepare: createPrepared,
    async exec(_query: string) {
      // Table creation - no-op in mock
      return { count: 0, duration: 0 };
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      for (const stmt of statements) {
        results.push(await stmt.all<T>());
      }
      return results;
    },
  };
}

function stateToRow(state: CardSyncState) {
  return {
    federated_id: state.federatedId,
    local_id: state.localId,
    platform_ids: JSON.stringify(state.platformIds),
    last_sync: JSON.stringify(state.lastSync),
    version_hash: state.versionHash,
    status: state.status,
    conflict: state.conflict ? JSON.stringify(state.conflict) : null,
    created_at: Date.now(),
    updated_at: Date.now(),
  };
}

describe('D1SyncStateStore', () => {
  let db: ReturnType<typeof createMockD1>;
  let store: D1SyncStateStore;

  const testState: CardSyncState = {
    federatedId: 'https://example.com/cards/123',
    localId: 'local-123',
    platformIds: { hub: 'hub-123', archive: 'archive-456' },
    lastSync: { hub: '2024-01-01T00:00:00Z', archive: '2024-01-02T00:00:00Z' },
    versionHash: 'abc123',
    status: 'synced',
  };

  beforeEach(async () => {
    db = createMockD1();
    store = new D1SyncStateStore(db);
    await store.init();
  });

  describe('init', () => {
    it('should create table without error', async () => {
      const newStore = new D1SyncStateStore(createMockD1());
      await expect(newStore.init()).resolves.toBeUndefined();
    });

    it('should use custom table name', async () => {
      const customStore = new D1SyncStateStore(createMockD1(), 'custom_table');
      await expect(customStore.init()).resolves.toBeUndefined();
    });
  });

  describe('set/get', () => {
    it('should store and retrieve a sync state', async () => {
      await store.set(testState);
      const retrieved = await store.get(testState.federatedId);

      expect(retrieved).toEqual(testState);
    });

    it('should return null for non-existent ID', async () => {
      const result = await store.get('non-existent');
      expect(result).toBeNull();
    });

    it('should update existing state', async () => {
      await store.set(testState);

      const updated = { ...testState, status: 'pending' as const };
      await store.set(updated);

      const retrieved = await store.get(testState.federatedId);
      expect(retrieved?.status).toBe('pending');
    });

    it('should handle conflict data', async () => {
      const stateWithConflict: CardSyncState = {
        ...testState,
        status: 'conflict',
        conflict: {
          localVersion: 'v1',
          remoteVersion: 'v2',
          remotePlatform: 'archive',
        },
      };

      await store.set(stateWithConflict);
      const retrieved = await store.get(stateWithConflict.federatedId);

      expect(retrieved?.conflict).toEqual({
        localVersion: 'v1',
        remoteVersion: 'v2',
        remotePlatform: 'archive',
      });
    });
  });

  describe('delete', () => {
    it('should delete a sync state', async () => {
      await store.set(testState);
      await store.delete(testState.federatedId);

      const result = await store.get(testState.federatedId);
      expect(result).toBeNull();
    });

    it('should not error when deleting non-existent ID', async () => {
      await expect(store.delete('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('list', () => {
    it('should list all sync states', async () => {
      const state2: CardSyncState = {
        ...testState,
        federatedId: 'https://example.com/cards/456',
        localId: 'local-456',
      };

      await store.set(testState);
      await store.set(state2);

      const all = await store.list();
      expect(all).toHaveLength(2);
    });

    it('should return empty array when no states', async () => {
      const all = await store.list();
      expect(all).toEqual([]);
    });
  });

  describe('findByPlatformId', () => {
    it('should find state by platform ID', async () => {
      await store.set(testState);

      const found = await store.findByPlatformId('hub', 'hub-123');
      expect(found?.federatedId).toBe(testState.federatedId);
    });

    it('should return null for non-existent platform ID', async () => {
      await store.set(testState);

      const found = await store.findByPlatformId('hub', 'non-existent');
      expect(found).toBeNull();
    });

    it('should return null for non-synced platform', async () => {
      await store.set(testState);

      const found = await store.findByPlatformId('risu', 'some-id');
      expect(found).toBeNull();
    });
  });

  describe('findByLocalId', () => {
    it('should find state by local ID', async () => {
      await store.set(testState);

      const found = await store.findByLocalId('local-123');
      expect(found?.federatedId).toBe(testState.federatedId);
    });

    it('should return null for non-existent local ID', async () => {
      const found = await store.findByLocalId('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('count', () => {
    it('should return count of all states', async () => {
      expect(await store.count()).toBe(0);

      await store.set(testState);
      expect(await store.count()).toBe(1);

      await store.set({ ...testState, federatedId: 'https://example.com/cards/999' });
      expect(await store.count()).toBe(2);
    });
  });

  describe('listByStatus', () => {
    it('should list states filtered by status', async () => {
      await store.set(testState);
      await store.set({ ...testState, federatedId: 'id2', status: 'pending' });
      await store.set({ ...testState, federatedId: 'id3', status: 'pending' });
      await store.set({ ...testState, federatedId: 'id4', status: 'error' });

      const synced = await store.listByStatus('synced');
      expect(synced).toHaveLength(1);

      const pending = await store.listByStatus('pending');
      expect(pending).toHaveLength(2);

      const errors = await store.listByStatus('error');
      expect(errors).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('should delete all states', async () => {
      await store.set(testState);
      await store.set({ ...testState, federatedId: 'id2' });

      await store.clear();

      const all = await store.list();
      expect(all).toEqual([]);
    });
  });
});
