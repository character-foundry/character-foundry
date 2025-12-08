/**
 * Lorebook Handler
 *
 * Format conversion and serialization utilities.
 */

import type { CCv3CharacterBook, CCv3LorebookEntry } from '@character-foundry/schemas';
import type {
  LorebookFormat,
  ParsedLorebook,
  SillyTavernWorldInfo,
  SillyTavernEntry,
  AgnaiLorebook,
  AgnaiEntry,
} from './types.js';

/**
 * Convert a CCv3 character_book to a specific format
 *
 * Preserves original shape if available for round-trip fidelity.
 */
export function convertLorebook(
  book: CCv3CharacterBook,
  targetFormat: LorebookFormat,
  originalShape?: unknown
): unknown {
  switch (targetFormat) {
    case 'ccv3':
      return book;
    case 'sillytavern':
      return toSillyTavern(book, originalShape as SillyTavernWorldInfo | undefined);
    case 'agnai':
      return toAgnai(book, originalShape as AgnaiLorebook | undefined);
    case 'risu':
      return toRisu(book, originalShape);
    case 'wyvern':
      return toWyvern(book, originalShape);
    default:
      return book;
  }
}

/**
 * Convert CCv3 to SillyTavern world_info format
 */
function toSillyTavern(
  book: CCv3CharacterBook,
  original?: SillyTavernWorldInfo
): SillyTavernWorldInfo {
  const entries: Record<string, SillyTavernEntry> = {};

  for (let i = 0; i < book.entries.length; i++) {
    const entry = book.entries[i]!;
    const uid = entry.id ?? i;

    // Try to recover original ST-specific fields
    const stExt = (entry.extensions?.sillytavern || {}) as Partial<SillyTavernEntry>;

    entries[String(uid)] = {
      uid,
      key: entry.keys,
      keysecondary: entry.secondary_keys,
      comment: entry.comment || entry.name,
      content: entry.content,
      constant: entry.constant,
      selective: entry.selective,
      selectiveLogic: stExt.selectiveLogic,
      order: entry.insertion_order,
      position: mapCCv3Position(entry.position),
      disable: !entry.enabled,
      excludeRecursion: stExt.excludeRecursion,
      probability: stExt.probability,
      useProbability: stExt.useProbability,
      depth: stExt.depth,
      group: stExt.group,
      scanDepth: stExt.scanDepth,
      caseSensitive: stExt.caseSensitive,
      matchWholeWords: stExt.matchWholeWords,
      automationId: stExt.automationId,
      role: stExt.role,
      vectorized: stExt.vectorized,
      groupOverride: stExt.groupOverride,
      groupWeight: stExt.groupWeight,
      sticky: stExt.sticky,
      cooldown: stExt.cooldown,
      delay: stExt.delay,
    };
  }

  return {
    entries,
    name: book.name,
    description: book.description,
  };
}

/**
 * Map CCv3 position to SillyTavern position number
 */
function mapCCv3Position(position?: CCv3LorebookEntry['position']): number {
  switch (position) {
    case 'before_char':
      return 0;
    case 'after_char':
      return 1;
    default:
      return 0;
  }
}

/**
 * Convert CCv3 to Agnai lorebook format
 */
function toAgnai(book: CCv3CharacterBook, original?: AgnaiLorebook): AgnaiLorebook {
  const entries: AgnaiEntry[] = book.entries.map((entry: CCv3LorebookEntry, i: number) => {
    // Try to recover original Agnai-specific fields
    const agnaiExt = (entry.extensions?.agnai || {}) as { weight?: number };

    return {
      name: entry.name || `Entry ${i}`,
      entry: entry.content,
      keywords: entry.keys,
      priority: entry.priority ?? 10,
      weight: agnaiExt.weight ?? 1,
      enabled: entry.enabled !== false,
    };
  });

  return {
    kind: 'memory',
    name: book.name || 'Lorebook',
    description: book.description,
    entries,
  };
}

/**
 * Convert CCv3 to Risu format (placeholder)
 */
function toRisu(book: CCv3CharacterBook, original?: unknown): unknown {
  // If we have original shape, preserve it
  if (original && typeof original === 'object') {
    const obj = original as Record<string, unknown>;
    return {
      ...obj,
      // Update with CCv3 data
      name: book.name,
      entries: book.entries,
    };
  }

  // Otherwise return basic structure
  return {
    type: 'risu',
    name: book.name,
    entries: book.entries,
  };
}

/**
 * Convert CCv3 to Wyvern format (placeholder)
 */
function toWyvern(book: CCv3CharacterBook, original?: unknown): unknown {
  // If we have original shape, preserve it
  if (original && typeof original === 'object') {
    const obj = original as Record<string, unknown>;
    return {
      ...obj,
      // Update with CCv3 data
      name: book.name,
      entries: book.entries,
    };
  }

  // Otherwise return basic structure
  return {
    format: 'wyvern',
    name: book.name,
    entries: book.entries,
  };
}

/**
 * Serialize a lorebook to JSON string
 */
export function serializeLorebook(
  book: CCv3CharacterBook,
  format: LorebookFormat = 'ccv3',
  originalShape?: unknown,
  pretty = true
): string {
  const converted = convertLorebook(book, format, originalShape);
  return pretty ? JSON.stringify(converted, null, 2) : JSON.stringify(converted);
}

/**
 * Round-trip a parsed lorebook back to its original format
 */
export function serializeParsedLorebook(
  parsed: ParsedLorebook,
  pretty = true
): string {
  return serializeLorebook(
    parsed.book,
    parsed.originalFormat,
    parsed.originalShape,
    pretty
  );
}

/**
 * Merge two lorebooks by combining their entries
 *
 * Note: This combines entries from two books into one.
 * Use with caution - the design preference is to keep lorebooks separate.
 * This is provided for cases where merging is explicitly desired.
 */
export function mergeLorebooks(
  bookA: CCv3CharacterBook,
  bookB: CCv3CharacterBook,
  name?: string
): CCv3CharacterBook {
  // Renumber entries from bookB to avoid ID conflicts
  const maxIdA = Math.max(0, ...bookA.entries.map((e: CCv3LorebookEntry) => e.id ?? 0));
  const renumberedB = bookB.entries.map((entry: CCv3LorebookEntry, i: number) => ({
    ...entry,
    id: maxIdA + 1 + i,
    insertion_order: bookA.entries.length + i,
  }));

  return {
    name: name || bookA.name || bookB.name,
    description: bookA.description || bookB.description,
    entries: [...bookA.entries, ...renumberedB],
    extensions: {
      ...bookA.extensions,
      ...bookB.extensions,
    },
  };
}

/**
 * Find entries matching keys (for lookup/search)
 */
export function findEntriesByKeys(
  book: CCv3CharacterBook,
  searchKeys: string[],
  options: {
    caseSensitive?: boolean;
    matchAll?: boolean;
  } = {}
): CCv3LorebookEntry[] {
  const { caseSensitive = false, matchAll = false } = options;

  const normalizeKey = (k: string) => (caseSensitive ? k : k.toLowerCase());
  const normalizedSearch = searchKeys.map(normalizeKey);

  return book.entries.filter((entry: CCv3LorebookEntry) => {
    const entryKeys = entry.keys.map(normalizeKey);

    if (matchAll) {
      // All search keys must be found
      return normalizedSearch.every((sk: string) => entryKeys.some((ek: string) => ek.includes(sk)));
    } else {
      // Any search key found
      return normalizedSearch.some((sk: string) => entryKeys.some((ek: string) => ek.includes(sk)));
    }
  });
}

/**
 * Find entry by name or ID
 */
export function findEntryByNameOrId(
  book: CCv3CharacterBook,
  nameOrId: string | number
): CCv3LorebookEntry | undefined {
  if (typeof nameOrId === 'number') {
    return book.entries.find((e: CCv3LorebookEntry) => e.id === nameOrId);
  }

  return book.entries.find(
    (e: CCv3LorebookEntry) => e.name === nameOrId || String(e.id) === nameOrId
  );
}

/**
 * Update an entry in a lorebook
 */
export function updateEntry(
  book: CCv3CharacterBook,
  entryId: number | string,
  updates: Partial<CCv3LorebookEntry>
): CCv3CharacterBook {
  const entries = book.entries.map((entry: CCv3LorebookEntry) => {
    const matches =
      entry.id === entryId ||
      entry.name === entryId ||
      String(entry.id) === entryId;

    if (matches) {
      return { ...entry, ...updates };
    }
    return entry;
  });

  return { ...book, entries };
}

/**
 * Add a new entry to a lorebook
 */
export function addEntry(
  book: CCv3CharacterBook,
  entry: Omit<CCv3LorebookEntry, 'id' | 'insertion_order'>
): CCv3CharacterBook {
  const maxId = Math.max(0, ...book.entries.map((e: CCv3LorebookEntry) => e.id ?? 0));
  const newEntry: CCv3LorebookEntry = {
    ...entry,
    id: maxId + 1,
    insertion_order: book.entries.length,
  };

  return {
    ...book,
    entries: [...book.entries, newEntry],
  };
}

/**
 * Remove an entry from a lorebook
 */
export function removeEntry(
  book: CCv3CharacterBook,
  entryId: number | string
): CCv3CharacterBook {
  const entries = book.entries.filter((entry: CCv3LorebookEntry) => {
    const matches =
      entry.id === entryId ||
      entry.name === entryId ||
      String(entry.id) === entryId;
    return !matches;
  });

  return { ...book, entries };
}

/**
 * Reorder entries in a lorebook
 */
export function reorderEntries(
  book: CCv3CharacterBook,
  entryIds: (number | string)[]
): CCv3CharacterBook {
  const entryMap = new Map<number | string | undefined, CCv3LorebookEntry>(
    book.entries.map((e: CCv3LorebookEntry) => [e.id ?? e.name, e])
  );

  const reordered: CCv3LorebookEntry[] = [];

  for (let i = 0; i < entryIds.length; i++) {
    const id = entryIds[i];
    const entry = entryMap.get(id) || book.entries.find((e: CCv3LorebookEntry) => e.name === id);

    if (entry) {
      reordered.push({ ...entry, insertion_order: i });
      entryMap.delete(entry.id ?? entry.name);
    }
  }

  // Add any remaining entries not in the reorder list
  for (const entry of entryMap.values()) {
    reordered.push({ ...entry, insertion_order: reordered.length });
  }

  return { ...book, entries: reordered };
}
