/**
 * Lorebook Parser
 *
 * Parse standalone lorebook files from various formats.
 */

import { type BinaryData, toString, ParseError } from '@character-foundry/core';
import type { CCv3CharacterBook, CCv3LorebookEntry } from '@character-foundry/schemas';
import type {
  ParsedLorebook,
  LorebookFormat,
  SillyTavernWorldInfo,
  SillyTavernEntry,
  AgnaiLorebook,
} from './types.js';

/**
 * Parse a standalone lorebook file
 *
 * Detects format and normalizes to CCv3 character_book structure.
 * Preserves original shape for round-trip.
 */
export function parseLorebook(data: BinaryData): ParsedLorebook {
  let json: unknown;

  try {
    const text = toString(data);
    json = JSON.parse(text);
  } catch (err) {
    throw new ParseError(
      `Failed to parse lorebook JSON: ${err instanceof Error ? err.message : String(err)}`,
      'lorebook'
    );
  }

  const format = detectLorebookFormat(json);
  const book = normalizeToCC3(json, format);

  return {
    book,
    originalFormat: format,
    originalShape: json,
  };
}

/**
 * Detect the format of a lorebook JSON object
 */
export function detectLorebookFormat(data: unknown): LorebookFormat {
  if (!data || typeof data !== 'object') {
    return 'unknown';
  }

  const obj = data as Record<string, unknown>;

  // CCv3 character_book - has entries array with keys/content
  if (Array.isArray(obj.entries)) {
    const firstEntry = obj.entries[0] as Record<string, unknown> | undefined;
    if (firstEntry && Array.isArray(firstEntry.keys) && 'content' in firstEntry) {
      return 'ccv3';
    }
  }

  // SillyTavern world_info - entries is an object keyed by uid
  if (obj.entries && typeof obj.entries === 'object' && !Array.isArray(obj.entries)) {
    const entries = obj.entries as Record<string, unknown>;
    const firstKey = Object.keys(entries)[0];
    if (firstKey) {
      const firstEntry = entries[firstKey] as Record<string, unknown>;
      if ('uid' in firstEntry && 'key' in firstEntry && 'content' in firstEntry) {
        return 'sillytavern';
      }
    }
  }

  // Agnai - has kind: 'memory'
  if (obj.kind === 'memory' && Array.isArray(obj.entries)) {
    const firstEntry = obj.entries[0] as Record<string, unknown> | undefined;
    if (firstEntry && 'keywords' in firstEntry && 'entry' in firstEntry) {
      return 'agnai';
    }
  }

  // Risu - check for risu-specific markers
  if (obj.type === 'risu' || obj.ripiVersion !== undefined) {
    return 'risu';
  }

  // Wyvern - check for wyvern-specific markers
  if (obj.format === 'wyvern' || obj.wyvern !== undefined) {
    return 'wyvern';
  }

  return 'unknown';
}

/**
 * Normalize any lorebook format to CCv3 character_book
 */
export function normalizeToCC3(
  data: unknown,
  format: LorebookFormat
): CCv3CharacterBook {
  switch (format) {
    case 'ccv3':
      return normalizeCCv3(data);
    case 'sillytavern':
      return normalizeSillyTavern(data as SillyTavernWorldInfo);
    case 'agnai':
      return normalizeAgnai(data as AgnaiLorebook);
    case 'risu':
      return normalizeRisu(data);
    case 'wyvern':
      return normalizeWyvern(data);
    case 'unknown':
    default:
      return attemptGenericNormalize(data);
  }
}

/**
 * Normalize CCv3 format (already correct, just validate)
 */
function normalizeCCv3(data: unknown): CCv3CharacterBook {
  const obj = data as Record<string, unknown>;

  return {
    name: typeof obj.name === 'string' ? obj.name : undefined,
    description: typeof obj.description === 'string' ? obj.description : undefined,
    entries: Array.isArray(obj.entries)
      ? obj.entries.map((e, i) => normalizeEntry(e, i))
      : [],
    extensions: typeof obj.extensions === 'object' ? obj.extensions as Record<string, unknown> : undefined,
  };
}

/**
 * Normalize SillyTavern world_info format
 */
function normalizeSillyTavern(data: SillyTavernWorldInfo): CCv3CharacterBook {
  const entries: CCv3LorebookEntry[] = [];

  if (data.entries && typeof data.entries === 'object') {
    const entryList = Object.values(data.entries) as SillyTavernEntry[];

    // Sort by order if available
    entryList.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    for (let i = 0; i < entryList.length; i++) {
      const e = entryList[i]!;
      entries.push({
        keys: Array.isArray(e.key) ? e.key : [],
        secondary_keys: Array.isArray(e.keysecondary) ? e.keysecondary : [],
        content: e.content || '',
        enabled: e.disable !== true,
        insertion_order: e.order ?? i,
        id: e.uid ?? i,
        name: e.comment || `Entry ${e.uid ?? i}`,
        comment: e.comment || '',
        priority: e.order ?? 10,
        selective: e.selective ?? false,
        constant: e.constant ?? false,
        position: mapSTPosition(e.position),
        extensions: {
          sillytavern: {
            uid: e.uid,
            selectiveLogic: e.selectiveLogic,
            excludeRecursion: e.excludeRecursion,
            probability: e.probability,
            useProbability: e.useProbability,
            depth: e.depth,
            group: e.group,
            scanDepth: e.scanDepth,
            caseSensitive: e.caseSensitive,
            matchWholeWords: e.matchWholeWords,
            automationId: e.automationId,
            role: e.role,
            vectorized: e.vectorized,
            groupOverride: e.groupOverride,
            groupWeight: e.groupWeight,
            sticky: e.sticky,
            cooldown: e.cooldown,
            delay: e.delay,
          },
        },
      });
    }
  }

  return {
    name: data.name,
    description: data.description,
    entries,
  };
}

/**
 * Map SillyTavern position to CCv3 position
 */
function mapSTPosition(pos?: number): CCv3LorebookEntry['position'] {
  switch (pos) {
    case 0: return 'before_char';
    case 1: return 'after_char';
    case 2: return 'before_char'; // Top of AN
    case 3: return 'after_char';  // Bottom of AN
    case 4: return 'before_char'; // @ D
    default: return 'before_char';
  }
}

/**
 * Normalize Agnai lorebook format
 */
function normalizeAgnai(data: AgnaiLorebook): CCv3CharacterBook {
  const entries: CCv3LorebookEntry[] = [];

  if (Array.isArray(data.entries)) {
    for (let i = 0; i < data.entries.length; i++) {
      const e = data.entries[i]!;
      entries.push({
        keys: Array.isArray(e.keywords) ? e.keywords : [],
        secondary_keys: [],
        content: e.entry || '',
        enabled: e.enabled !== false,
        insertion_order: i,
        id: i,
        name: e.name || `Entry ${i}`,
        comment: '',
        priority: e.priority ?? 10,
        selective: false,
        constant: false,
        position: 'before_char',
        extensions: {
          agnai: {
            weight: e.weight,
          },
        },
      });
    }
  }

  return {
    name: data.name,
    description: data.description,
    entries,
  };
}

/**
 * Normalize Risu lorebook format
 */
function normalizeRisu(data: unknown): CCv3CharacterBook {
  // TODO: Implement when we have Risu lorebook samples
  const obj = data as Record<string, unknown>;

  return {
    name: typeof obj.name === 'string' ? obj.name : 'Risu Lorebook',
    entries: [],
    extensions: { risu: obj },
  };
}

/**
 * Normalize Wyvern lorebook format
 */
function normalizeWyvern(data: unknown): CCv3CharacterBook {
  // TODO: Implement when we have Wyvern lorebook samples
  const obj = data as Record<string, unknown>;

  return {
    name: typeof obj.name === 'string' ? obj.name : 'Wyvern Lorebook',
    entries: [],
    extensions: { wyvern: obj },
  };
}

/**
 * Attempt generic normalization for unknown formats
 */
function attemptGenericNormalize(data: unknown): CCv3CharacterBook {
  const obj = data as Record<string, unknown>;
  const entries: CCv3LorebookEntry[] = [];

  // Try to find an entries-like array
  const possibleEntries = obj.entries || obj.items || obj.lore || obj.data;

  if (Array.isArray(possibleEntries)) {
    for (let i = 0; i < possibleEntries.length; i++) {
      const e = possibleEntries[i] as Record<string, unknown>;
      entries.push(normalizeEntry(e, i));
    }
  }

  return {
    name: typeof obj.name === 'string' ? obj.name : 'Unknown Lorebook',
    description: typeof obj.description === 'string' ? obj.description : undefined,
    entries,
    extensions: { original: obj },
  };
}

/**
 * Normalize a single entry from various formats
 */
function normalizeEntry(entry: unknown, index: number): CCv3LorebookEntry {
  const e = entry as Record<string, unknown>;

  // Try various key field names
  let keys: string[] = [];
  if (Array.isArray(e.keys)) keys = e.keys as string[];
  else if (Array.isArray(e.key)) keys = e.key as string[];
  else if (Array.isArray(e.keywords)) keys = e.keywords as string[];
  else if (typeof e.keys === 'string') keys = [e.keys];
  else if (typeof e.key === 'string') keys = (e.key as string).split(',').map(k => k.trim());

  // Try various content field names
  let content = '';
  if (typeof e.content === 'string') content = e.content;
  else if (typeof e.entry === 'string') content = e.entry;
  else if (typeof e.text === 'string') content = e.text;
  else if (typeof e.value === 'string') content = e.value;

  return {
    keys,
    secondary_keys: Array.isArray(e.secondary_keys) ? e.secondary_keys as string[] : [],
    content,
    enabled: e.enabled !== false && e.disable !== true,
    insertion_order: typeof e.insertion_order === 'number' ? e.insertion_order : index,
    id: typeof e.id === 'number' ? e.id : index,
    name: typeof e.name === 'string' ? e.name : `Entry ${index}`,
    comment: typeof e.comment === 'string' ? e.comment : '',
    priority: typeof e.priority === 'number' ? e.priority : 10,
    selective: e.selective === true,
    constant: e.constant === true,
    position: 'before_char',
  };
}
