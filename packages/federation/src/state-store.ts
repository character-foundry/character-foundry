/**
 * Sync State Stores
 *
 * Implementations for storing sync state.
 */

import type {
  SyncStateStore,
  CardSyncState,
  PlatformId,
  ForkNotification,
} from './types.js';

/**
 * In-memory sync state store
 * Useful for testing and single-session sync
 */
export class MemorySyncStateStore implements SyncStateStore {
  private states: Map<string, CardSyncState> = new Map();

  async get(federatedId: string): Promise<CardSyncState | null> {
    return this.states.get(federatedId) || null;
  }

  async set(state: CardSyncState): Promise<void> {
    this.states.set(state.federatedId, { ...state });
  }

  async delete(federatedId: string): Promise<void> {
    this.states.delete(federatedId);
  }

  async list(): Promise<CardSyncState[]> {
    return Array.from(this.states.values());
  }

  async findByPlatformId(
    platform: PlatformId,
    platformId: string
  ): Promise<CardSyncState | null> {
    for (const state of this.states.values()) {
      if (state.platformIds[platform] === platformId) {
        return state;
      }
    }
    return null;
  }

  /**
   * Clear all states (for testing)
   */
  clear(): void {
    this.states.clear();
  }

  /**
   * Increment fork count and add notification
   */
  async incrementForkCount(
    federatedId: string,
    notification: ForkNotification
  ): Promise<void> {
    const state = this.states.get(federatedId);
    if (!state) return;

    // Cap notifications at 100
    const notifications = state.forkNotifications || [];
    if (notifications.length < 100) {
      notifications.push(notification);
    }

    state.forksCount = (state.forksCount || 0) + 1;
    state.forkNotifications = notifications;
    this.states.set(federatedId, state);
  }

  /**
   * Get fork count for a card
   */
  async getForkCount(federatedId: string): Promise<number> {
    return this.states.get(federatedId)?.forksCount || 0;
  }

  /**
   * Find all cards that are forks of a given source card
   */
  async findForks(sourceFederatedId: string): Promise<CardSyncState[]> {
    const forks: CardSyncState[] = [];
    for (const state of this.states.values()) {
      if (state.forkedFrom?.federatedId === sourceFederatedId) {
        forks.push(state);
      }
    }
    return forks;
  }
}

/**
 * JSON file-based sync state store
 * Persists state to a JSON file
 */
export class FileSyncStateStore implements SyncStateStore {
  private states: Map<string, CardSyncState> = new Map();
  private filePath: string;
  private saveDebounce?: ReturnType<typeof setTimeout>;
  private fs: {
    readFile: (path: string, encoding: string) => Promise<string>;
    writeFile: (path: string, data: string) => Promise<void>;
    mkdir: (path: string, options: { recursive: boolean }) => Promise<void>;
  };

  constructor(
    filePath: string,
    fs: {
      readFile: (path: string, encoding: string) => Promise<string>;
      writeFile: (path: string, data: string) => Promise<void>;
      mkdir: (path: string, options: { recursive: boolean }) => Promise<void>;
    }
  ) {
    this.filePath = filePath;
    this.fs = fs;
  }

  /**
   * Load state from file
   */
  async load(): Promise<void> {
    try {
      const content = await this.fs.readFile(this.filePath, 'utf-8');
      const data = JSON.parse(content) as CardSyncState[];
      this.states.clear();
      for (const state of data) {
        this.states.set(state.federatedId, state);
      }
    } catch {
      // File doesn't exist or is invalid - start fresh
      this.states.clear();
    }
  }

  /**
   * Save state to file (debounced)
   */
  private scheduleSave(): void {
    if (this.saveDebounce) {
      clearTimeout(this.saveDebounce);
    }
    this.saveDebounce = setTimeout(() => this.saveNow(), 1000);
  }

  /**
   * Save state to file immediately
   */
  async saveNow(): Promise<void> {
    const data = Array.from(this.states.values());
    const json = JSON.stringify(data, null, 2);

    // Ensure directory exists
    const dir = this.filePath.substring(0, this.filePath.lastIndexOf('/'));
    if (dir) {
      await this.fs.mkdir(dir, { recursive: true });
    }

    await this.fs.writeFile(this.filePath, json);
  }

  async get(federatedId: string): Promise<CardSyncState | null> {
    return this.states.get(federatedId) || null;
  }

  async set(state: CardSyncState): Promise<void> {
    this.states.set(state.federatedId, { ...state });
    this.scheduleSave();
  }

  async delete(federatedId: string): Promise<void> {
    this.states.delete(federatedId);
    this.scheduleSave();
  }

  async list(): Promise<CardSyncState[]> {
    return Array.from(this.states.values());
  }

  async findByPlatformId(
    platform: PlatformId,
    platformId: string
  ): Promise<CardSyncState | null> {
    for (const state of this.states.values()) {
      if (state.platformIds[platform] === platformId) {
        return state;
      }
    }
    return null;
  }

  /**
   * Increment fork count and add notification
   */
  async incrementForkCount(
    federatedId: string,
    notification: ForkNotification
  ): Promise<void> {
    const state = this.states.get(federatedId);
    if (!state) return;

    // Cap notifications at 100
    const notifications = state.forkNotifications || [];
    if (notifications.length < 100) {
      notifications.push(notification);
    }

    state.forksCount = (state.forksCount || 0) + 1;
    state.forkNotifications = notifications;
    this.states.set(federatedId, state);
    this.scheduleSave();
  }

  /**
   * Get fork count for a card
   */
  async getForkCount(federatedId: string): Promise<number> {
    return this.states.get(federatedId)?.forksCount || 0;
  }

  /**
   * Find all cards that are forks of a given source card
   */
  async findForks(sourceFederatedId: string): Promise<CardSyncState[]> {
    const forks: CardSyncState[] = [];
    for (const state of this.states.values()) {
      if (state.forkedFrom?.federatedId === sourceFederatedId) {
        forks.push(state);
      }
    }
    return forks;
  }
}

/**
 * Storage interface (compatible with Web Storage API)
 */
export interface StorageInterface {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Create a state store backed by a Storage interface (e.g., localStorage in browser)
 *
 * @param key - Prefix key for storage entries
 * @param storage - Storage interface (pass localStorage in browser, or a polyfill in Node.js)
 */
export function createLocalStorageStore(
  key: string,
  storage: StorageInterface
): SyncStateStore {
  return {
    async get(federatedId: string): Promise<CardSyncState | null> {
      const data = storage.getItem(`${key}:${federatedId}`);
      return data ? JSON.parse(data) : null;
    },

    async set(state: CardSyncState): Promise<void> {
      storage.setItem(`${key}:${state.federatedId}`, JSON.stringify(state));
      // Also update index
      const indexKey = `${key}:__index__`;
      const index = JSON.parse(storage.getItem(indexKey) || '[]') as string[];
      if (!index.includes(state.federatedId)) {
        index.push(state.federatedId);
        storage.setItem(indexKey, JSON.stringify(index));
      }
    },

    async delete(federatedId: string): Promise<void> {
      storage.removeItem(`${key}:${federatedId}`);
      // Update index
      const indexKey = `${key}:__index__`;
      const index = JSON.parse(storage.getItem(indexKey) || '[]') as string[];
      const newIndex = index.filter((id) => id !== federatedId);
      storage.setItem(indexKey, JSON.stringify(newIndex));
    },

    async list(): Promise<CardSyncState[]> {
      const indexKey = `${key}:__index__`;
      const index = JSON.parse(storage.getItem(indexKey) || '[]') as string[];
      const states: CardSyncState[] = [];
      for (const id of index) {
        const data = storage.getItem(`${key}:${id}`);
        if (data) {
          states.push(JSON.parse(data));
        }
      }
      return states;
    },

    async findByPlatformId(
      platform: PlatformId,
      platformId: string
    ): Promise<CardSyncState | null> {
      const states = await this.list();
      return states.find((s) => s.platformIds[platform] === platformId) || null;
    },
  };
}
