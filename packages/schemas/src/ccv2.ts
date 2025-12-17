/**
 * Character Card v2 Types
 *
 * Based on: https://github.com/malfoyslastname/character-card-spec-v2
 */

import { z } from 'zod';

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Lorebook entry schema for v2 cards
 */
export const CCv2LorebookEntrySchema = z.object({
  keys: z.array(z.string()).optional(), // Some tools use 'key' instead
  content: z.string(),
  enabled: z.boolean().default(true), // Default to enabled if missing
  insertion_order: z.preprocess((v) => v ?? 0, z.number().int()),
  // Optional fields - be lenient with nulls since wild data has them
  extensions: z.record(z.unknown()).optional(),
  case_sensitive: z.boolean().nullable().optional(),
  name: z.string().optional(),
  priority: z.number().int().nullable().optional(),
  id: z.number().int().nullable().optional(),
  comment: z.string().nullable().optional(),
  selective: z.boolean().nullable().optional(),
  secondary_keys: z.array(z.string()).nullable().optional(),
  constant: z.boolean().nullable().optional(),
  position: z.union([z.enum(['before_char', 'after_char', 'in_chat']), z.number().int(), z.literal('')]).nullable().optional(),
}).passthrough(); // Allow SillyTavern extensions like depth, probability, etc.

/**
 * Character book (lorebook) schema for v2 cards
 */
export const CCv2CharacterBookSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  scan_depth: z.number().int().nonnegative().optional(),
  token_budget: z.number().int().nonnegative().optional(),
  recursive_scanning: z.boolean().optional(),
  extensions: z.record(z.unknown()).optional(),
  entries: z.array(CCv2LorebookEntrySchema),
});

/**
 * Character Card v2 data structure schema
 */
export const CCv2DataSchema = z.object({
  // Core fields - use .default('') to handle missing fields in malformed cards
  name: z.string().default(''),
  description: z.string().default(''),
  personality: z.string().nullable().default(''),  // Can be null in wild (141 cards)
  scenario: z.string().default(''),
  first_mes: z.string().default(''),
  mes_example: z.string().nullable().default(''),  // Can be null in wild (186 cards)
  // Optional fields
  creator_notes: z.string().optional(),
  system_prompt: z.string().optional(),
  post_history_instructions: z.string().optional(),
  alternate_greetings: z.array(z.string()).optional(),
  character_book: CCv2CharacterBookSchema.optional().nullable(),
  tags: z.array(z.string()).optional(),
  creator: z.string().optional(),
  character_version: z.string().optional(),
  extensions: z.record(z.unknown()).optional(),
});

/**
 * Wrapped v2 card format schema (modern tools)
 */
export const CCv2WrappedSchema = z.object({
  spec: z.literal('chara_card_v2'),
  spec_version: z.literal('2.0'),
  data: CCv2DataSchema,
});

// ============================================================================
// TypeScript Types (inferred from Zod schemas)
// ============================================================================

/**
 * Lorebook entry for v2 cards
 */
export type CCv2LorebookEntry = z.infer<typeof CCv2LorebookEntrySchema>;

/**
 * Character book (lorebook) for v2 cards
 */
export type CCv2CharacterBook = z.infer<typeof CCv2CharacterBookSchema>;

/**
 * Character Card v2 data structure
 */
export type CCv2Data = z.infer<typeof CCv2DataSchema>;

/**
 * Wrapped v2 card format (modern tools)
 */
export type CCv2Wrapped = z.infer<typeof CCv2WrappedSchema>;

// ============================================================================
// Type Guards & Parsers
// ============================================================================

/**
 * Check if data is a wrapped v2 card
 */
export function isWrappedV2(data: unknown): data is CCv2Wrapped {
  return CCv2WrappedSchema.safeParse(data).success;
}

/**
 * Check if data looks like v2 card data (wrapped or unwrapped)
 */
export function isV2CardData(data: unknown): data is CCv2Data | CCv2Wrapped {
  return (
    CCv2WrappedSchema.safeParse(data).success ||
    CCv2DataSchema.safeParse(data).success
  );
}

/**
 * Parse and validate a wrapped v2 card
 */
export function parseWrappedV2(data: unknown): CCv2Wrapped {
  return CCv2WrappedSchema.parse(data);
}

/**
 * Parse and validate v2 card data
 */
export function parseV2Data(data: unknown): CCv2Data {
  return CCv2DataSchema.parse(data);
}

/**
 * Check if data looks like a wrapped V2 card structurally (without strict validation).
 * This is more lenient than isWrappedV2 - it just checks structure, not full schema validity.
 */
export function looksLikeWrappedV2(data: unknown): data is { spec: string; data: Record<string, unknown> } {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    obj.spec === 'chara_card_v2' &&
    obj.data !== null &&
    typeof obj.data === 'object'
  );
}

/**
 * Get v2 card data from wrapped or unwrapped format.
 *
 * Uses structural check instead of strict Zod validation to handle
 * malformed cards that have the right structure but missing/invalid fields.
 * The caller (e.g., ccv2ToCCv3) handles defaulting missing fields.
 */
export function getV2Data(card: CCv2Data | CCv2Wrapped): CCv2Data {
  // Use structural check - more lenient than isWrappedV2 schema validation
  if (looksLikeWrappedV2(card)) {
    return card.data as CCv2Data;
  }
  return card;
}
