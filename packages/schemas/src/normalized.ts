/**
 * Normalized Card Types
 *
 * Unified view of card data regardless of source format.
 * This is a computed/virtual representation, not stored.
 */

import type { CCv3CharacterBook } from './ccv3.js';

/**
 * Normalized card representation
 * Provides unified access to card data from any format
 */
export interface NormalizedCard {
  // Core fields (always present)
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMes: string;
  mesExample: string;

  // Optional prompts
  systemPrompt?: string;
  postHistoryInstructions?: string;

  // Arrays
  alternateGreetings: string[];
  groupOnlyGreetings: string[];
  tags: string[];

  // Metadata
  creator?: string;
  creatorNotes?: string;
  characterVersion?: string;

  // Character book (v3 format)
  characterBook?: CCv3CharacterBook;

  // Extensions (preserved as-is)
  extensions: Record<string, unknown>;
}

/**
 * Create empty normalized card with defaults
 */
export function createEmptyNormalizedCard(): NormalizedCard {
  return {
    name: '',
    description: '',
    personality: '',
    scenario: '',
    firstMes: '',
    mesExample: '',
    alternateGreetings: [],
    groupOnlyGreetings: [],
    tags: [],
    extensions: {},
  };
}

/**
 * Derived features extracted from card (not stored in card)
 */
export interface DerivedFeatures {
  // Content flags
  hasAlternateGreetings: boolean;
  alternateGreetingsCount: number;
  hasLorebook: boolean;
  lorebookEntriesCount: number;
  hasEmbeddedImages: boolean;
  embeddedImagesCount: number;
  hasGallery: boolean;

  // Format-specific
  hasRisuExtensions: boolean;
  hasRisuScripts: boolean;
  hasDepthPrompt: boolean;
  hasVoxtaAppearance: boolean;

  // Token counts (estimated)
  tokens: {
    description: number;
    personality: number;
    scenario: number;
    firstMes: number;
    mesExample: number;
    systemPrompt: number;
    total: number;
  };
}

/**
 * Create empty derived features
 */
export function createEmptyFeatures(): DerivedFeatures {
  return {
    hasAlternateGreetings: false,
    alternateGreetingsCount: 0,
    hasLorebook: false,
    lorebookEntriesCount: 0,
    hasEmbeddedImages: false,
    embeddedImagesCount: 0,
    hasGallery: false,
    hasRisuExtensions: false,
    hasRisuScripts: false,
    hasDepthPrompt: false,
    hasVoxtaAppearance: false,
    tokens: {
      description: 0,
      personality: 0,
      scenario: 0,
      firstMes: 0,
      mesExample: 0,
      systemPrompt: 0,
      total: 0,
    },
  };
}
