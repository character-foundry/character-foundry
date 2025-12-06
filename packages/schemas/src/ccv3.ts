/**
 * Character Card v3 Types
 *
 * Based on: https://github.com/kwaroran/character-card-spec-v3
 */

import type { AssetDescriptor } from './common.js';

/**
 * Lorebook entry for v3 cards
 */
export interface CCv3LorebookEntry {
  keys: string[];
  content: string;
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
  extensions?: Record<string, unknown>;
  // v3 specific
  automation_id?: string;
  role?: 'system' | 'user' | 'assistant';
  group?: string;
  scan_frequency?: number;
  probability?: number;
  use_regex?: boolean;
  depth?: number;
  selective_logic?: 'AND' | 'NOT';
}

/**
 * Character book (lorebook) for v3 cards
 */
export interface CCv3CharacterBook {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions?: Record<string, unknown>;
  entries: CCv3LorebookEntry[];
}

/**
 * Character Card v3 inner data structure
 */
export interface CCv3DataInner {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  // Required metadata
  creator: string;
  character_version: string;
  tags: string[];
  // Required field (can be empty array)
  group_only_greetings: string[];
  // Optional fields
  creator_notes?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  alternate_greetings?: string[];
  character_book?: CCv3CharacterBook;
  extensions?: Record<string, unknown>;
  // v3 specific
  assets?: AssetDescriptor[];
  nickname?: string;
  creator_notes_multilingual?: Record<string, string>;
  source?: string[];
  creation_date?: number;     // Unix timestamp in seconds
  modification_date?: number; // Unix timestamp in seconds
}

/**
 * Character Card v3 full structure
 */
export interface CCv3Data {
  spec: 'chara_card_v3';
  spec_version: '3.0';
  data: CCv3DataInner;
}

/**
 * Check if data is a v3 card
 */
export function isV3Card(data: unknown): data is CCv3Data {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return obj.spec === 'chara_card_v3' && obj.data !== undefined;
}

/**
 * Get v3 card inner data
 */
export function getV3Data(card: CCv3Data): CCv3DataInner {
  return card.data;
}
