/**
 * D1 Sync State Store
 *
 * Cloudflare D1-compatible implementation of SyncStateStore for production
 * federation support on Cloudflare Workers.
 */

import type { SyncStateStore, CardSyncState, PlatformId, ForkNotification } from './types.js';

/**
 * Minimal D1Database interface
 * Compatible with Cloudflare Workers D1 API
 */
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<D1ExecResult>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(column?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: {
    duration: number;
    changes: number;
    last_row_id: number;
    served_by?: string;
  };
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

/**
 * Database row representation for CardSyncState
 */
interface SyncStateRow {
  federated_id: string;
  local_id: string;
  platform_ids: string;
  last_sync: string;
  version_hash: string;
  status: 'synced' | 'pending' | 'conflict' | 'error';
  conflict: string | null;
  forked_from: string | null;
  forks_count: number;
  fork_notifications: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * D1-compatible implementation of SyncStateStore
 *
 * Stores federation sync state in Cloudflare D1 (SQLite).
 *
 * @example
 * ```typescript
 * const store = new D1SyncStateStore(env.DB);
 * await store.init();
 *
 * // Use with SyncEngine
 * const engine = new SyncEngine({
 *   stateStore: store,
 *   // ...
 * });
 * ```
 */
export class D1SyncStateStore implements SyncStateStore {
  private db: D1Database;
  private tableName: string;

  /**
   * Create a new D1SyncStateStore
   *
   * @param db - D1Database instance (from env.DB in Workers)
   * @param tableName - Table name for storing sync state (default: 'federation_sync_state')
   */
  constructor(db: D1Database, tableName = 'federation_sync_state') {
    this.db = db;
    this.tableName = tableName;
  }

  /**
   * Initialize the database table
   *
   * Creates the sync state table if it doesn't exist.
   * Safe to call multiple times (idempotent).
   */
  async init(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        federated_id TEXT PRIMARY KEY,
        local_id TEXT NOT NULL,
        platform_ids TEXT NOT NULL,
        last_sync TEXT NOT NULL,
        version_hash TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('synced', 'pending', 'conflict', 'error')),
        conflict TEXT,
        forked_from TEXT,
        forks_count INTEGER DEFAULT 0,
        fork_notifications TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // Create index for platform ID lookups
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_local_id ON ${this.tableName}(local_id)
    `);

    // Create index for finding forks of a source card
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_forked_from
      ON ${this.tableName}(json_extract(forked_from, '$.federatedId'))
    `);
  }

  /**
   * Get sync state for a federated card ID
   */
  async get(federatedId: string): Promise<CardSyncState | null> {
    const row = await this.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE federated_id = ?`)
      .bind(federatedId)
      .first<SyncStateRow>();

    return row ? this.rowToState(row) : null;
  }

  /**
   * Save or update sync state
   */
  async set(state: CardSyncState): Promise<void> {
    const platformIds = JSON.stringify(state.platformIds);
    const lastSync = JSON.stringify(state.lastSync);
    const conflict = state.conflict ? JSON.stringify(state.conflict) : null;
    const forkedFrom = state.forkedFrom ? JSON.stringify(state.forkedFrom) : null;
    const forkNotifications = state.forkNotifications
      ? JSON.stringify(state.forkNotifications)
      : null;

    await this.db
      .prepare(
        `INSERT INTO ${this.tableName} (federated_id, local_id, platform_ids, last_sync, version_hash, status, conflict, forked_from, forks_count, fork_notifications, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
         ON CONFLICT(federated_id) DO UPDATE SET
           local_id = excluded.local_id,
           platform_ids = excluded.platform_ids,
           last_sync = excluded.last_sync,
           version_hash = excluded.version_hash,
           status = excluded.status,
           conflict = excluded.conflict,
           forked_from = excluded.forked_from,
           forks_count = excluded.forks_count,
           fork_notifications = excluded.fork_notifications,
           updated_at = unixepoch()`
      )
      .bind(
        state.federatedId,
        state.localId,
        platformIds,
        lastSync,
        state.versionHash,
        state.status,
        conflict,
        forkedFrom,
        state.forksCount ?? 0,
        forkNotifications
      )
      .run();
  }

  /**
   * Delete sync state for a federated card ID
   */
  async delete(federatedId: string): Promise<void> {
    await this.db
      .prepare(`DELETE FROM ${this.tableName} WHERE federated_id = ?`)
      .bind(federatedId)
      .run();
  }

  /**
   * List all sync states
   */
  async list(): Promise<CardSyncState[]> {
    const result = await this.db
      .prepare(`SELECT * FROM ${this.tableName} ORDER BY updated_at DESC`)
      .all<SyncStateRow>();

    return result.results.map((row) => this.rowToState(row));
  }

  /**
   * Find sync state by platform-specific ID
   *
   * @param platform - Platform identifier
   * @param platformId - Platform-specific card ID
   * @returns Sync state if found, null otherwise
   */
  async findByPlatformId(
    platform: PlatformId,
    platformId: string
  ): Promise<CardSyncState | null> {
    // D1 supports JSON extraction with json_extract()
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.tableName}
         WHERE json_extract(platform_ids, ?) = ?`
      )
      .bind(`$.${platform}`, platformId)
      .first<SyncStateRow>();

    return result ? this.rowToState(result) : null;
  }

  /**
   * Find sync state by local ID
   *
   * @param localId - Local card ID
   * @returns Sync state if found, null otherwise
   */
  async findByLocalId(localId: string): Promise<CardSyncState | null> {
    const row = await this.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE local_id = ?`)
      .bind(localId)
      .first<SyncStateRow>();

    return row ? this.rowToState(row) : null;
  }

  /**
   * Get count of all sync states
   */
  async count(): Promise<number> {
    const result = await this.db
      .prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`)
      .first<{ count: number }>();

    return result?.count ?? 0;
  }

  /**
   * List sync states by status
   *
   * @param status - Status to filter by
   * @returns Array of sync states with matching status
   */
  async listByStatus(
    status: CardSyncState['status']
  ): Promise<CardSyncState[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.tableName} WHERE status = ? ORDER BY updated_at DESC`
      )
      .bind(status)
      .all<SyncStateRow>();

    return result.results.map((row) => this.rowToState(row));
  }

  /**
   * Clear all sync states (for testing)
   *
   * ⚠️  Use with caution - this deletes all data
   */
  async clear(): Promise<void> {
    await this.db.prepare(`DELETE FROM ${this.tableName}`).run();
  }

  /**
   * Increment fork count and add notification for a source card
   *
   * Used when receiving a Fork activity to track that someone forked this card.
   * Notifications are capped at 100 to prevent unbounded growth.
   */
  async incrementForkCount(
    federatedId: string,
    notification: ForkNotification
  ): Promise<void> {
    const state = await this.get(federatedId);
    if (!state) {
      return;
    }

    // Cap notifications at 100
    const notifications = state.forkNotifications || [];
    if (notifications.length < 100) {
      notifications.push(notification);
    }

    state.forksCount = (state.forksCount || 0) + 1;
    state.forkNotifications = notifications;

    await this.set(state);
  }

  /**
   * Get fork count for a card
   */
  async getForkCount(federatedId: string): Promise<number> {
    const result = await this.db
      .prepare(`SELECT forks_count FROM ${this.tableName} WHERE federated_id = ?`)
      .bind(federatedId)
      .first<{ forks_count: number }>();

    return result?.forks_count ?? 0;
  }

  /**
   * Find all cards that are forks of a given source card
   */
  async findForks(sourceFederatedId: string): Promise<CardSyncState[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.tableName}
         WHERE json_extract(forked_from, '$.federatedId') = ?
         ORDER BY updated_at DESC`
      )
      .bind(sourceFederatedId)
      .all<SyncStateRow>();

    return result.results.map((row) => this.rowToState(row));
  }

  /**
   * Convert database row to CardSyncState
   */
  private rowToState(row: SyncStateRow): CardSyncState {
    const state: CardSyncState = {
      federatedId: row.federated_id,
      localId: row.local_id,
      platformIds: JSON.parse(row.platform_ids) as Partial<Record<PlatformId, string>>,
      lastSync: JSON.parse(row.last_sync) as Partial<Record<PlatformId, string>>,
      versionHash: row.version_hash,
      status: row.status,
      conflict: row.conflict
        ? (JSON.parse(row.conflict) as CardSyncState['conflict'])
        : undefined,
    };

    // Add fork fields if present
    if (row.forked_from) {
      state.forkedFrom = JSON.parse(row.forked_from) as CardSyncState['forkedFrom'];
    }
    if (row.forks_count > 0) {
      state.forksCount = row.forks_count;
    }
    if (row.fork_notifications) {
      state.forkNotifications = JSON.parse(row.fork_notifications) as ForkNotification[];
    }

    return state;
  }
}
