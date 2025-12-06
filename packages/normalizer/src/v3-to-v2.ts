/**
 * CCv3 to CCv2 Converter
 *
 * Converts CCv3 card data to CCv2 format.
 * Note: Some v3 features will be lost (group_only_greetings, etc.)
 */

import type {
  CCv2Data,
  CCv2Wrapped,
  CCv2CharacterBook,
  CCv2LorebookEntry,
  CCv3Data,
} from '@character-foundry/schemas';

/**
 * Fields lost when converting v3 to v2
 */
export const V3_TO_V2_LOST_FIELDS = [
  'group_only_greetings',
  'assets',
];

/**
 * Convert CCv3 lorebook entry to CCv2 format
 */
function convertLorebookEntry(
  entry: CCv3Data['data']['character_book'] extends { entries: (infer E)[] } | undefined ? E : never
): CCv2LorebookEntry {
  return {
    keys: entry.keys,
    content: entry.content,
    extensions: entry.extensions || {},
    enabled: entry.enabled,
    insertion_order: entry.insertion_order,
    case_sensitive: entry.case_sensitive,
    name: entry.name,
    priority: entry.priority,
    id: entry.id,
    comment: entry.comment,
    selective: entry.selective,
    secondary_keys: entry.secondary_keys,
    constant: entry.constant,
    position: entry.position,
  };
}

/**
 * Convert CCv3 character book to CCv2 format
 */
function convertCharacterBook(
  book: NonNullable<CCv3Data['data']['character_book']>
): CCv2CharacterBook {
  return {
    name: book.name,
    description: book.description,
    scan_depth: book.scan_depth,
    token_budget: book.token_budget,
    recursive_scanning: book.recursive_scanning,
    extensions: book.extensions,
    entries: book.entries.map(convertLorebookEntry),
  };
}

/**
 * Convert CCv3 card to CCv2 unwrapped format
 *
 * @param card - CCv3 card data
 * @returns CCv2 unwrapped card data
 */
export function ccv3ToCCv2Data(card: CCv3Data): CCv2Data {
  const data = card.data;

  return {
    name: data.name,
    description: data.description,
    personality: data.personality,
    scenario: data.scenario,
    first_mes: data.first_mes,
    mes_example: data.mes_example,
    creator_notes: data.creator_notes,
    system_prompt: data.system_prompt,
    post_history_instructions: data.post_history_instructions,
    alternate_greetings: data.alternate_greetings,
    tags: data.tags,
    creator: data.creator,
    character_version: data.character_version,
    character_book: data.character_book
      ? convertCharacterBook(data.character_book)
      : undefined,
    extensions: data.extensions,
  };
}

/**
 * Convert CCv3 card to CCv2 wrapped format
 *
 * @param card - CCv3 card data
 * @returns CCv2 wrapped card data
 */
export function ccv3ToCCv2Wrapped(card: CCv3Data): CCv2Wrapped {
  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: ccv3ToCCv2Data(card),
  };
}

/**
 * Check what would be lost converting v3 to v2
 */
export function checkV3ToV2Loss(card: CCv3Data): string[] {
  const lost: string[] = [];

  if (card.data.group_only_greetings && card.data.group_only_greetings.length > 0) {
    lost.push(`group_only_greetings (${card.data.group_only_greetings.length} entries)`);
  }

  if (card.data.assets && card.data.assets.length > 0) {
    lost.push(`assets (${card.data.assets.length} entries)`);
  }

  return lost;
}
