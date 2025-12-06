/**
 * Base Platform Adapter
 *
 * Abstract base class for platform adapters.
 */

import type { CCv3Data } from '@character-foundry/schemas';
import type { PlatformId, PlatformAdapter } from '../types.js';

/**
 * Card with metadata from adapter
 */
export interface AdapterCard {
  id: string;
  card: CCv3Data;
  updatedAt: string;
  createdAt?: string;
}

/**
 * Asset from adapter
 */
export interface AdapterAsset {
  name: string;
  type: string;
  data: Uint8Array;
  mimeType?: string;
}

/**
 * Abstract base adapter with common functionality
 */
export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract readonly platform: PlatformId;
  abstract readonly displayName: string;

  /**
   * Check if platform is available
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Get a card by local ID
   */
  abstract getCard(localId: string): Promise<CCv3Data | null>;

  /**
   * List all cards
   */
  abstract listCards(options?: {
    limit?: number;
    offset?: number;
    since?: string;
  }): Promise<AdapterCard[]>;

  /**
   * Save/update a card
   */
  abstract saveCard(card: CCv3Data, localId?: string): Promise<string>;

  /**
   * Delete a card
   */
  abstract deleteCard(localId: string): Promise<boolean>;

  /**
   * Get card assets
   */
  abstract getAssets(localId: string): Promise<AdapterAsset[]>;

  /**
   * Get last modified timestamp
   */
  abstract getLastModified(localId: string): Promise<string | null>;

  /**
   * Generate a new local ID
   */
  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  }
}

/**
 * In-memory adapter for testing
 */
export class MemoryPlatformAdapter extends BasePlatformAdapter {
  readonly platform: PlatformId;
  readonly displayName: string;

  private cards: Map<string, AdapterCard> = new Map();
  private assets: Map<string, AdapterAsset[]> = new Map();

  constructor(platform: PlatformId = 'custom', displayName = 'Memory Store') {
    super();
    this.platform = platform;
    this.displayName = displayName;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getCard(localId: string): Promise<CCv3Data | null> {
    const entry = this.cards.get(localId);
    return entry?.card || null;
  }

  async listCards(options?: {
    limit?: number;
    offset?: number;
    since?: string;
  }): Promise<AdapterCard[]> {
    let cards = Array.from(this.cards.values());

    // Filter by since
    if (options?.since) {
      const sinceDate = new Date(options.since);
      cards = cards.filter((c) => new Date(c.updatedAt) > sinceDate);
    }

    // Sort by updated time (newest first)
    cards.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || cards.length;
    cards = cards.slice(offset, offset + limit);

    return cards;
  }

  async saveCard(card: CCv3Data, localId?: string): Promise<string> {
    const id = localId || this.generateId();
    const now = new Date().toISOString();

    const existing = this.cards.get(id);

    this.cards.set(id, {
      id,
      card,
      updatedAt: now,
      createdAt: existing?.createdAt || now,
    });

    return id;
  }

  async deleteCard(localId: string): Promise<boolean> {
    const existed = this.cards.has(localId);
    this.cards.delete(localId);
    this.assets.delete(localId);
    return existed;
  }

  async getAssets(localId: string): Promise<AdapterAsset[]> {
    return this.assets.get(localId) || [];
  }

  async getLastModified(localId: string): Promise<string | null> {
    const entry = this.cards.get(localId);
    return entry?.updatedAt || null;
  }

  /**
   * Set assets for a card (for testing)
   */
  setAssets(localId: string, assets: AdapterAsset[]): void {
    this.assets.set(localId, assets);
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.cards.clear();
    this.assets.clear();
  }

  /**
   * Get card count
   */
  count(): number {
    return this.cards.size;
  }
}
