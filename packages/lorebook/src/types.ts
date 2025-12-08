/**
 * Lorebook Types
 *
 * Type definitions for lorebook handling across formats.
 */

import type { CCv3CharacterBook, CCv3LorebookEntry } from '@character-foundry/schemas';

/**
 * Known lorebook formats
 */
export type LorebookFormat =
  | 'ccv3'           // Standard CCv3 character_book
  | 'sillytavern'    // SillyTavern world_info JSON
  | 'agnai'          // Agnai lorebook format
  | 'risu'           // RisuAI .risulorebook
  | 'wyvern'         // Wyvern format
  | 'unknown';

/**
 * Result of parsing a standalone lorebook file
 */
export interface ParsedLorebook {
  /** Normalized CCv3 format */
  book: CCv3CharacterBook;
  /** Original format detected */
  originalFormat: LorebookFormat;
  /** Raw original data for round-trip preservation */
  originalShape: unknown;
}

/**
 * Reference to a linked/external lorebook found in card extensions
 */
export interface LorebookRef {
  /** Source URL */
  url: string;
  /** Platform identifier */
  platform: string;
  /** ID on source platform */
  id?: string;
  /** Display name if available */
  name?: string;
}

/**
 * A downloaded/fetched linked lorebook with source tracking
 */
export interface LinkedLorebook {
  /** Source URL */
  source: string;
  /** Platform identifier */
  platform: string;
  /** ID on source platform */
  sourceId?: string;
  /** When it was fetched (ISO timestamp) */
  fetchedAt: string;
  /** Display name */
  name?: string;
  /** The actual lorebook content */
  book: CCv3CharacterBook;
}

/**
 * Source metadata stamped on entries from linked lorebooks
 * Stored in entry.extensions.lorebookSource
 */
export interface EntrySourceMeta {
  /** Source URL of the linked lorebook */
  linkedFrom: string;
  /** Platform identifier */
  platform: string;
  /** When the lorebook was fetched */
  fetchedAt: string;
  /** Original entry ID/name in source */
  originalEntryId?: string;
  /** Lorebook name for display */
  lorebookName?: string;
}

/**
 * A card's complete lorebook collection (multiple books, never merged)
 */
export interface LorebookCollection {
  /** Embedded lorebooks (directly in card) - can be multiple */
  embedded: CCv3CharacterBook[];
  /** Linked lorebooks (fetched from external sources) */
  linked: LinkedLorebook[];
}

/**
 * Extended entry with source tracking
 */
export interface TrackedEntry extends CCv3LorebookEntry {
  extensions?: {
    lorebookSource?: EntrySourceMeta;
    [key: string]: unknown;
  };
}

/**
 * SillyTavern world_info format (for reference)
 */
export interface SillyTavernWorldInfo {
  entries: Record<string, SillyTavernEntry>;
  name?: string;
  description?: string;
}

export interface SillyTavernEntry {
  uid: number;
  key: string[];
  keysecondary?: string[];
  comment?: string;
  content: string;
  constant?: boolean;
  selective?: boolean;
  selectiveLogic?: number;
  order?: number;
  position?: number;
  disable?: boolean;
  excludeRecursion?: boolean;
  probability?: number;
  useProbability?: boolean;
  depth?: number;
  group?: string;
  scanDepth?: number;
  caseSensitive?: boolean;
  matchWholeWords?: boolean;
  automationId?: string;
  role?: number;
  vectorized?: boolean;
  groupOverride?: boolean;
  groupWeight?: number;
  sticky?: number;
  cooldown?: number;
  delay?: number;
}

/**
 * Agnai lorebook format (for reference)
 */
export interface AgnaiLorebook {
  kind: 'memory';
  name: string;
  description?: string;
  entries: AgnaiEntry[];
}

export interface AgnaiEntry {
  name: string;
  entry: string;
  keywords: string[];
  priority: number;
  weight: number;
  enabled: boolean;
}
