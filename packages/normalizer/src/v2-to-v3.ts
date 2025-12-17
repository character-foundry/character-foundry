/**
 * CCv2 to CCv3 Converter
 *
 * Converts CCv2 card data to CCv3 format.
 * Handles malformed cards gracefully by defaulting missing fields.
 */

import type {
  CCv2Data,
  CCv2Wrapped,
  CCv2LorebookEntry,
  CCv3Data,
  CCv3CharacterBook,
  CCv3LorebookEntry,
} from '@character-foundry/schemas';
import { getV2Data } from '@character-foundry/schemas';

/**
 * Normalize position field - accepts both string literals and SillyTavern numeric values.
 * SillyTavern uses: 0 = before_char, 1 = after_char, other numbers passed through.
 */
function normalizePosition(
  position: 'before_char' | 'after_char' | '' | number | null | undefined
): 'before_char' | 'after_char' | number {
  if (position === undefined || position === null || position === '') return 'before_char';
  if (typeof position === 'string') return position;
  // SillyTavern numeric mapping - pass through as-is since schema now accepts numbers
  return position;
}

/**
 * Convert CCv2 lorebook entry to CCv3 format
 */
function convertLorebookEntry(
  entry: CCv2LorebookEntry,
  index: number
): CCv3LorebookEntry {
  return {
    keys: entry.keys || [],
    content: entry.content || '',
    extensions: entry.extensions || {},
    enabled: entry.enabled ?? true,
    insertion_order: entry.insertion_order ?? index,
    case_sensitive: entry.case_sensitive,
    name: entry.name || '',
    priority: entry.priority ?? 10,
    id: entry.id ?? index,
    comment: entry.comment || '',
    selective: entry.selective ?? false,
    secondary_keys: entry.secondary_keys || [],
    constant: entry.constant ?? false,
    position: normalizePosition(entry.position),
  };
}

/**
 * Convert CCv2 character book to CCv3 format
 */
function convertCharacterBook(
  book: NonNullable<CCv2Data['character_book']>
): CCv3CharacterBook {
  return {
    name: book.name,
    description: book.description,
    scan_depth: book.scan_depth,
    token_budget: book.token_budget,
    recursive_scanning: book.recursive_scanning,
    extensions: book.extensions,
    entries: book.entries.map((entry, i) => convertLorebookEntry(entry, i)),
  };
}

/**
 * Convert CCv2 card to CCv3 format.
 *
 * Philosophy: Be lenient on input - never completely drop data due to missing fields.
 * Defaults are applied for any missing required fields to ensure valid output.
 * Pure 1:1 field mapping - no extraction, no magic.
 *
 * @param input - CCv2 card data (wrapped or unwrapped, potentially malformed)
 * @returns CCv3 card data with all required fields populated
 */
export function ccv2ToCCv3(input: CCv2Data | CCv2Wrapped): CCv3Data {
  const data = getV2Data(input);

  return {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      // Core required fields - default to empty string if missing/undefined
      name: data.name ?? '',
      description: data.description ?? '',
      personality: data.personality ?? '',
      scenario: data.scenario ?? '',
      first_mes: data.first_mes ?? '',
      mes_example: data.mes_example ?? '',
      // Optional in V2, required in V3 - always provide defaults
      creator_notes: data.creator_notes || '',
      system_prompt: data.system_prompt || '',
      post_history_instructions: data.post_history_instructions || '',
      alternate_greetings: data.alternate_greetings || [],
      group_only_greetings: [],
      tags: data.tags || [],
      creator: data.creator || '',
      character_version: data.character_version || '',
      character_book: data.character_book
        ? convertCharacterBook(data.character_book)
        : undefined,
      extensions: data.extensions || {},
    },
  };
}
