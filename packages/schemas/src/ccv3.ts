/**
 * Character Card v3 Types
 *
 * Based on: https://github.com/kwaroran/character-card-spec-v3
 */

import { z } from 'zod';
import { AssetDescriptorSchema } from './common.js';

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Lorebook entry schema for v3 cards
 */
export const CCv3LorebookEntrySchema = z.object({
  keys: z.array(z.string()).optional(), // Some tools use 'key' instead
  content: z.string(),
  enabled: z.boolean().default(true), // Default to enabled if missing
  insertion_order: z.preprocess((v) => v ?? 0, z.number().int()),
  // Optional fields - be lenient with nulls since wild data has them
  case_sensitive: z.boolean().nullable().optional(),
  name: z.string().optional(),
  priority: z.number().int().nullable().optional(),
  id: z.number().int().nullable().optional(),
  comment: z.string().nullable().optional(),
  selective: z.boolean().nullable().optional(),
  secondary_keys: z.array(z.string()).nullable().optional(),
  constant: z.boolean().nullable().optional(),
  position: z.union([z.enum(['before_char', 'after_char']), z.number().int(), z.literal('')]).nullable().optional(),
  extensions: z.record(z.unknown()).optional(),
  // v3 specific - also lenient with types since SillyTavern uses numbers for enums
  automation_id: z.string().optional(),
  role: z.union([z.enum(['system', 'user', 'assistant']), z.number().int()]).nullable().optional(),
  group: z.string().optional(),
  scan_frequency: z.number().int().nonnegative().optional(),
  probability: z.number().min(0).max(100).optional(), // Some tools use 0-100 instead of 0-1
  use_regex: z.boolean().optional(),
  depth: z.number().int().nonnegative().optional(),
  selective_logic: z.union([z.enum(['AND', 'NOT']), z.number().int()]).optional(),
}).passthrough(); // Allow tool-specific extensions

/**
 * Character book (lorebook) schema for v3 cards
 */
export const CCv3CharacterBookSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  scan_depth: z.number().int().nonnegative().optional(),
  token_budget: z.number().int().nonnegative().optional(),
  recursive_scanning: z.boolean().optional(),
  extensions: z.record(z.unknown()).optional(),
  entries: z.array(CCv3LorebookEntrySchema),
});

/**
 * Character Card v3 inner data structure schema.
 *
 * Note: Fields like group_only_greetings, creator, character_version, and tags
 * are technically "required" per V3 spec but rarely present in wild cards.
 * We use .default() to make parsing lenient while still producing valid output.
 */
export const CCv3DataInnerSchema = z.object({
  // Core fields - use .default('') to handle missing fields in malformed cards
  name: z.string().default(''),
  description: z.string().default(''),
  personality: z.string().nullable().default(''),  // Can be null in wild (141 cards)
  scenario: z.string().default(''),
  first_mes: z.string().default(''),
  mes_example: z.string().nullable().default(''),  // Can be null in wild (186 cards)
  // "Required" per spec but often missing in wild - use defaults for leniency
  creator: z.string().default(''),
  character_version: z.string().default(''),
  tags: z.array(z.string()).default([]),
  group_only_greetings: z.array(z.string()).default([]),
  // Optional fields
  creator_notes: z.string().optional(),
  system_prompt: z.string().optional(),
  post_history_instructions: z.string().optional(),
  alternate_greetings: z.array(z.string()).optional(),
  character_book: CCv3CharacterBookSchema.optional().nullable(),
  extensions: z.record(z.unknown()).optional(),
  // v3 specific
  assets: z.array(AssetDescriptorSchema).optional(),
  nickname: z.string().optional(),
  creator_notes_multilingual: z.record(z.string()).optional(),
  source: z.array(z.string()).optional(),
  creation_date: z.number().int().nonnegative().optional(),     // Unix timestamp in seconds
  modification_date: z.number().int().nonnegative().optional(), // Unix timestamp in seconds
});

/**
 * Character Card v3 full structure schema
 */
export const CCv3DataSchema = z.object({
  spec: z.literal('chara_card_v3'),
  spec_version: z.literal('3.0'),
  data: CCv3DataInnerSchema,
});

// ============================================================================
// TypeScript Types (inferred from Zod schemas)
// ============================================================================

/**
 * Lorebook entry for v3 cards
 */
export type CCv3LorebookEntry = z.infer<typeof CCv3LorebookEntrySchema>;

/**
 * Character book (lorebook) for v3 cards
 */
export type CCv3CharacterBook = z.infer<typeof CCv3CharacterBookSchema>;

/**
 * Character Card v3 inner data structure
 */
export type CCv3DataInner = z.infer<typeof CCv3DataInnerSchema>;

/**
 * Character Card v3 full structure
 */
export type CCv3Data = z.infer<typeof CCv3DataSchema>;

// ============================================================================
// Type Guards & Parsers
// ============================================================================

/**
 * Check if data is a v3 card
 */
export function isV3Card(data: unknown): data is CCv3Data {
  return CCv3DataSchema.safeParse(data).success;
}

/**
 * Parse and validate a v3 card
 */
export function parseV3Card(data: unknown): CCv3Data {
  return CCv3DataSchema.parse(data);
}

/**
 * Parse and validate v3 card inner data
 */
export function parseV3DataInner(data: unknown): CCv3DataInner {
  return CCv3DataInnerSchema.parse(data);
}

/**
 * Get v3 card inner data
 */
export function getV3Data(card: CCv3Data): CCv3DataInner {
  return card.data;
}

/**
 * Check if data looks like a V3 card structurally (without strict validation).
 * More lenient than isV3Card - just checks structure, not full schema validity.
 */
export function looksLikeV3Card(data: unknown): data is { spec: string; data: Record<string, unknown> } {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    obj.spec === 'chara_card_v3' &&
    obj.data !== null &&
    typeof obj.data === 'object'
  );
}
