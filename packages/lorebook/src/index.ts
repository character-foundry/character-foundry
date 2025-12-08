/**
 * @character-foundry/lorebook
 *
 * Lorebook parsing, extraction, and insertion utilities.
 *
 * Key concepts:
 * - Multiple separate lorebooks per card (never smooshed into one)
 * - Linked lorebooks tracked via entry.extensions.lorebookSource
 * - Format detection and normalization to CCv3
 * - Round-trip preservation of original format
 */

// Types
export type {
  LorebookFormat,
  ParsedLorebook,
  LorebookRef,
  LinkedLorebook,
  EntrySourceMeta,
  LorebookCollection,
  TrackedEntry,
  SillyTavernWorldInfo,
  SillyTavernEntry,
  AgnaiLorebook,
  AgnaiEntry,
} from './types.js';

// Parser - format detection and normalization
export {
  parseLorebook,
  detectLorebookFormat,
  normalizeToCC3,
} from './parser.js';

// Extractor - extract linked refs and separate entries
export {
  extractLorebookRefs,
  extractLinkedEntries,
  getLorebookCollection,
} from './extractor.js';

// Inserter - stamp entries and manage lorebooks on cards
export {
  stampEntriesWithSource,
  createLinkedLorebook,
  addLinkedLorebookToCard,
  addEmbeddedLorebookToCard,
  removeLorebookFromCard,
  removeLinkedEntriesBySource,
  replaceLorebookInCard,
  setLorebookCollection,
} from './inserter.js';

// Handler - format conversion and utilities
export {
  convertLorebook,
  serializeLorebook,
  serializeParsedLorebook,
  mergeLorebooks,
  findEntriesByKeys,
  findEntryByNameOrId,
  updateEntry,
  addEntry,
  removeEntry,
  reorderEntries,
} from './handler.js';
