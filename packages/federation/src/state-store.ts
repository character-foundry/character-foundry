/**
 * Sync State Stores
 *
 * Implementations for storing sync state.
 */

import type {
  SyncStateStore,
  CardSyncState,
  PlatformId,
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
    } catch (err) {
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
}

/**
 * Create a state store backed by localStorage (browser)
 */
export function createLocalStorageStore(key: string): SyncStateStore {
  return {
    async get(federatedId: string): Promise<CardSyncState | null> {
      const data = localStorage.getItem(`${key}:${federatedId}`);
      return data ? JSON.parse(data) : null;
    },

    async set(state: CardSyncState): Promise<void> {
      localStorage.setItem(`${key}:${state.federatedId}`, JSON.stringify(state));
      // Also update index
      const indexKey = `${key}:__index__`;
      const index = JSON.parse(localStorage.getItem(indexKey) || '[]') as string[];
      if (!index.includes(state.federatedId)) {
        index.push(state.federatedId);
        localStorage.setItem(indexKey, JSON.stringify(index));
      }
    },

    async delete(federatedId: string): Promise<void> {
      localStorage.removeItem(`${key}:${federatedId}`);
      // Update index
      const indexKey = `${key}:__index__`;
      const index = JSON.parse(localStorage.getItem(indexKey) || '[]') as string[];
      const newIndex = index.filter((id) => id !== federatedId);
      localStorage.setItem(indexKey, JSON.stringify(newIndex));
    },

    async list(): Promise<CardSyncState[]> {
      const indexKey = `${key}:__index__`;
      const index = JSON.parse(localStorage.getItem(indexKey) || '[]') as string[];
      const states: CardSyncState[] = [];
      for (const id of index) {
        const data = localStorage.getItem(`${key}:${id}`);
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
