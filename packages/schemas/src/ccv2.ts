/**
 * Character Card v2 Types
 *
 * Based on: https://github.com/malfoyslastname/character-card-spec-v2
 */

/**
 * Lorebook entry for v2 cards
 */
export interface CCv2LorebookEntry {
  keys: string[];
  content: string;
  extensions: Record<string, unknown>;
  enabled: boolean;
  insertion_order: number;
  // Optional fields
  case_sensitive?: boolean;
  name?: string;
  priority?: number;
  id?: number;
  comment?: string;
  selective?: boolean;
  secondary_keys?: string[];
  constant?: boolean;
  position?: 'before_char' | 'after_char';
}

/**
 * Character book (lorebook) for v2 cards
 */
export interface CCv2CharacterBook {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions?: Record<string, unknown>;
  entries: CCv2LorebookEntry[];
}

/**
 * Character Card v2 data structure
 */
export interface CCv2Data {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  // Optional fields
  creator_notes?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  alternate_greetings?: string[];
  character_book?: CCv2CharacterBook;
  tags?: string[];
  creator?: string;
  character_version?: string;
  extensions?: Record<string, unknown>;
}

/**
 * Wrapped v2 card format (modern tools)
 */
export interface CCv2Wrapped {
  spec: 'chara_card_v2';
  spec_version: '2.0';
  data: CCv2Data;
}

/**
 * Check if data is a wrapped v2 card
 */
export function isWrappedV2(data: unknown): data is CCv2Wrapped {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return obj.spec === 'chara_card_v2' && obj.data !== undefined;
}

/**
 * Check if data looks like v2 card data (wrapped or unwrapped)
 */
export function isV2CardData(data: unknown): data is CCv2Data | CCv2Wrapped {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;

  // Wrapped format
  if (obj.spec === 'chara_card_v2') return true;

  // Unwrapped format - check for required v2 fields
  if (typeof obj.name === 'string') {
    if ('description' in obj || 'personality' in obj || 'scenario' in obj) {
      // Make sure it's not v3
      if (obj.spec !== 'chara_card_v3') return true;
    }
  }

  return false;
}

/**
 * Get v2 card data from wrapped or unwrapped format
 */
export function getV2Data(card: CCv2Data | CCv2Wrapped): CCv2Data {
  if (isWrappedV2(card)) {
    return card.data;
  }
  return card;
}
