/**
 * Card Normalizer
 *
 * Handles normalization of malformed card data from various sources.
 * Fixes common issues like wrong spec values, misplaced fields, missing required fields.
 */

import type { CCv2Data, CCv2Wrapped, CCv2CharacterBook, CCv2LorebookEntry } from './ccv2.js';
import type { CCv3Data, CCv3CharacterBook, CCv3LorebookEntry } from './ccv3.js';
import { detectSpec } from './detection.js';

/**
 * Position values as numbers (non-standard) and their string equivalents
 */
const POSITION_MAP: Record<number, 'before_char' | 'after_char'> = {
  0: 'before_char',
  1: 'after_char',
};

/**
 * V3-only lorebook entry fields that should be moved to extensions for V2
 */
const V3_ONLY_ENTRY_FIELDS = [
  'probability',
  'depth',
  'group',
  'scan_frequency',
  'use_regex',
  'selective_logic',
  'role',
  'automation_id',
] as const;

/**
 * Required V2 card fields with their defaults
 */
const V2_REQUIRED_DEFAULTS: Partial<CCv2Data> = {
  name: '',
  description: '',
  personality: '',
  scenario: '',
  first_mes: '',
  mes_example: '',
};

/**
 * Required V3 card fields with their defaults
 */
const V3_REQUIRED_DEFAULTS: Partial<CCv3Data['data']> = {
  name: '',
  description: '',
  personality: '',
  scenario: '',
  first_mes: '',
  mes_example: '',
  creator: '',
  character_version: '1.0',
  tags: [],
  group_only_greetings: [],
};

/**
 * Fields that belong at root level for wrapped format
 */
const ROOT_FIELDS = ['spec', 'spec_version', 'data'] as const;

/**
 * Fields that belong in the data object
 */
const DATA_FIELDS = [
  'name',
  'description',
  'personality',
  'scenario',
  'first_mes',
  'mes_example',
  'creator_notes',
  'system_prompt',
  'post_history_instructions',
  'alternate_greetings',
  'character_book',
  'tags',
  'creator',
  'character_version',
  'extensions',
  'assets',
  'nickname',
  'creator_notes_multilingual',
  'source',
  'creation_date',
  'modification_date',
  'group_only_greetings',
] as const;

/**
 * Deep clone an object without mutating the original
 */
function deepClone<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as T;
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = deepClone(value);
    }
    return result as T;
  }
  return obj;
}

/**
 * Check if a timestamp is in milliseconds (13+ digits)
 */
function isMilliseconds(timestamp: number): boolean {
  // Timestamps before year 2001 in seconds: < 1000000000
  // Timestamps in milliseconds are typically 13 digits: 1000000000000+
  return timestamp > 10000000000;
}

/**
 * CardNormalizer - handles normalization of malformed card data
 */
export const CardNormalizer = {
  /**
   * Normalize card data to valid schema format.
   *
   * Handles:
   * - Fixing spec/spec_version values
   * - Moving misplaced fields to correct locations
   * - Adding missing required fields with defaults
   * - Handling hybrid formats (fields at root AND in data object)
   *
   * @param data - Raw card data (potentially malformed)
   * @param spec - Target spec version
   * @returns Normalized card data (does not mutate input)
   */
  normalize(data: unknown, spec: 'v2' | 'v3'): CCv2Wrapped | CCv3Data {
    if (!data || typeof data !== 'object') {
      // Return minimal valid card
      if (spec === 'v3') {
        return {
          spec: 'chara_card_v3',
          spec_version: '3.0',
          data: { ...V3_REQUIRED_DEFAULTS } as CCv3Data['data'],
        };
      }
      return {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: { ...V2_REQUIRED_DEFAULTS } as CCv2Data,
      };
    }

    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    // Build merged data object from root fields + existing data object
    const existingData = (obj.data && typeof obj.data === 'object' ? obj.data : {}) as Record<
      string,
      unknown
    >;
    const mergedData: Record<string, unknown> = {};

    // Copy existing data first
    for (const [key, value] of Object.entries(existingData)) {
      mergedData[key] = deepClone(value);
    }

    // Move any misplaced root-level data fields into data object
    // (ChubAI hybrid format fix)
    for (const field of DATA_FIELDS) {
      if (field in obj && !(field in mergedData)) {
        mergedData[field] = deepClone(obj[field]);
      }
    }

    // Handle character_book: null -> remove entirely
    if (mergedData.character_book === null) {
      delete mergedData.character_book;
    }

    // Normalize character_book if present
    if (mergedData.character_book && typeof mergedData.character_book === 'object') {
      mergedData.character_book = this.normalizeCharacterBook(
        mergedData.character_book as Record<string, unknown>,
        spec
      );
    }

    // Apply defaults for required fields
    const defaults = spec === 'v3' ? V3_REQUIRED_DEFAULTS : V2_REQUIRED_DEFAULTS;
    for (const [key, defaultValue] of Object.entries(defaults)) {
      if (!(key in mergedData) || mergedData[key] === undefined) {
        mergedData[key] = Array.isArray(defaultValue) ? [...defaultValue] : defaultValue;
      }
    }

    // Ensure arrays are actually arrays
    if (mergedData.tags && !Array.isArray(mergedData.tags)) {
      mergedData.tags = [];
    }
    if (mergedData.alternate_greetings && !Array.isArray(mergedData.alternate_greetings)) {
      mergedData.alternate_greetings = [];
    }
    if (spec === 'v3') {
      if (
        mergedData.group_only_greetings &&
        !Array.isArray(mergedData.group_only_greetings)
      ) {
        mergedData.group_only_greetings = [];
      }
    }

    // Build result with correct spec
    if (spec === 'v3') {
      result.spec = 'chara_card_v3';
      result.spec_version = '3.0';
      result.data = this.fixTimestampsInner(mergedData);
    } else {
      result.spec = 'chara_card_v2';
      result.spec_version = '2.0';
      result.data = mergedData;
    }

    return result as unknown as CCv2Wrapped | CCv3Data;
  },

  /**
   * Normalize a character book (lorebook).
   *
   * Handles:
   * - Ensuring required fields exist
   * - Converting numeric position values to string enums
   * - Moving V3-only fields to extensions for V2 compatibility
   *
   * @param book - Raw character book data
   * @param spec - Target spec version
   * @returns Normalized character book
   */
  normalizeCharacterBook(
    book: Record<string, unknown>,
    spec: 'v2' | 'v3'
  ): CCv2CharacterBook | CCv3CharacterBook {
    const result: Record<string, unknown> = {};

    // Copy book-level fields
    if (book.name !== undefined) result.name = book.name;
    if (book.description !== undefined) result.description = book.description;
    if (book.scan_depth !== undefined) result.scan_depth = book.scan_depth;
    if (book.token_budget !== undefined) result.token_budget = book.token_budget;
    if (book.recursive_scanning !== undefined)
      result.recursive_scanning = book.recursive_scanning;
    if (book.extensions !== undefined) result.extensions = deepClone(book.extensions);

    // Normalize entries
    const entries = Array.isArray(book.entries) ? book.entries : [];
    result.entries = entries.map((entry) =>
      this.normalizeEntry(entry as Record<string, unknown>, spec)
    );

    return result as unknown as CCv2CharacterBook | CCv3CharacterBook;
  },

  /**
   * Normalize a single lorebook entry.
   *
   * Handles:
   * - Converting numeric position to string enum
   * - Moving V3-only fields to extensions for V2
   * - Ensuring required fields exist
   *
   * @param entry - Raw entry data
   * @param spec - Target spec version
   * @returns Normalized entry
   */
  normalizeEntry(
    entry: Record<string, unknown>,
    spec: 'v2' | 'v3'
  ): CCv2LorebookEntry | CCv3LorebookEntry {
    const result: Record<string, unknown> = {};

    // Required fields with defaults
    result.keys = Array.isArray(entry.keys) ? [...entry.keys] : [];
    result.content = typeof entry.content === 'string' ? entry.content : '';
    result.enabled = entry.enabled !== false; // default true
    result.insertion_order =
      typeof entry.insertion_order === 'number' ? entry.insertion_order : 0;

    // For V2, extensions is required
    if (spec === 'v2') {
      result.extensions =
        entry.extensions && typeof entry.extensions === 'object'
          ? deepClone(entry.extensions)
          : {};
    }

    // Optional fields
    if (entry.case_sensitive !== undefined) result.case_sensitive = entry.case_sensitive;
    if (entry.name !== undefined) result.name = entry.name;
    if (entry.priority !== undefined) result.priority = entry.priority;
    if (entry.id !== undefined) result.id = entry.id;
    if (entry.comment !== undefined) result.comment = entry.comment;
    if (entry.selective !== undefined) result.selective = entry.selective;
    if (entry.secondary_keys !== undefined) {
      result.secondary_keys = Array.isArray(entry.secondary_keys)
        ? [...entry.secondary_keys]
        : [];
    }
    if (entry.constant !== undefined) result.constant = entry.constant;

    // Position: convert numeric to string enum
    if (entry.position !== undefined) {
      if (typeof entry.position === 'number') {
        result.position = POSITION_MAP[entry.position] || 'before_char';
      } else if (entry.position === 'before_char' || entry.position === 'after_char') {
        result.position = entry.position;
      }
    }

    // Handle V3-only fields
    if (spec === 'v3') {
      // Copy V3 fields directly
      if (entry.extensions !== undefined) result.extensions = deepClone(entry.extensions);
      for (const field of V3_ONLY_ENTRY_FIELDS) {
        if (entry[field] !== undefined) {
          result[field] = entry[field];
        }
      }
    } else {
      // V2: Move V3-only fields to extensions
      const ext = (result.extensions || {}) as Record<string, unknown>;
      for (const field of V3_ONLY_ENTRY_FIELDS) {
        if (entry[field] !== undefined) {
          ext[field] = entry[field];
        }
      }
      result.extensions = ext;
    }

    return result as unknown as CCv2LorebookEntry | CCv3LorebookEntry;
  },

  /**
   * Fix CharacterTavern timestamp format (milliseconds -> seconds).
   *
   * CCv3 spec requires timestamps in seconds (Unix epoch).
   * CharacterTavern exports timestamps in milliseconds.
   *
   * @param data - V3 card data
   * @returns Card data with fixed timestamps (does not mutate input)
   */
  fixTimestamps(data: CCv3Data): CCv3Data {
    const result = deepClone(data);
    result.data = this.fixTimestampsInner(
      result.data as unknown as Record<string, unknown>
    ) as unknown as CCv3Data['data'];
    return result;
  },

  /**
   * Internal: fix timestamps in data object
   */
  fixTimestampsInner(data: Record<string, unknown>): Record<string, unknown> {
    const result = { ...data };

    if (typeof result.creation_date === 'number' && isMilliseconds(result.creation_date)) {
      result.creation_date = Math.floor(result.creation_date / 1000);
    }

    if (
      typeof result.modification_date === 'number' &&
      isMilliseconds(result.modification_date)
    ) {
      result.modification_date = Math.floor(result.modification_date / 1000);
    }

    return result;
  },

  /**
   * Auto-detect spec and normalize.
   *
   * @param data - Raw card data
   * @returns Normalized card data, or null if not a valid card
   */
  autoNormalize(data: unknown): CCv2Wrapped | CCv3Data | null {
    const spec = detectSpec(data);
    if (!spec) return null;

    // V1 cards get upgraded to V2
    const targetSpec = spec === 'v3' ? 'v3' : 'v2';
    return this.normalize(data, targetSpec);
  },
};

export type { CCv2Wrapped, CCv3Data };
