/**
 * Format Detection
 *
 * Detect card specification version from JSON data.
 */

import type { Spec } from './common.js';

/**
 * Detect card spec version from parsed JSON
 * Returns 'v2', 'v3', or null if not recognized
 */
export function detectSpec(data: unknown): Spec | null {
  if (!data || typeof data !== 'object') return null;

  const obj = data as Record<string, unknown>;

  // Explicit v3 spec marker
  if (obj.spec === 'chara_card_v3') {
    return 'v3';
  }

  // Explicit v2 spec marker
  if (obj.spec === 'chara_card_v2') {
    return 'v2';
  }

  // spec_version 2.0
  if (obj.spec_version === '2.0' || obj.spec_version === 2.0) {
    return 'v2';
  }

  // Wrapped format with data object
  if (obj.spec && obj.data && typeof obj.data === 'object') {
    const dataObj = obj.data as Record<string, unknown>;
    if (dataObj.name && typeof dataObj.name === 'string') {
      // Infer from spec string
      if (typeof obj.spec === 'string') {
        if (obj.spec.includes('v3') || obj.spec.includes('3')) {
          return 'v3';
        }
        if (obj.spec.includes('v2') || obj.spec.includes('2')) {
          return 'v2';
        }
      }
      // Default wrapped format to v3 (modern)
      return 'v3';
    }
  }

  // Unwrapped format - check for v2-like structure
  if (obj.name && typeof obj.name === 'string') {
    if ('description' in obj || 'personality' in obj || 'scenario' in obj) {
      return 'v2';
    }
  }

  return null;
}

/**
 * Check if card has a lorebook
 */
export function hasLorebook(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;

  // Check wrapped format
  const wrapped = obj.data as Record<string, unknown> | undefined;
  if (wrapped?.character_book) {
    const book = wrapped.character_book as Record<string, unknown>;
    if (Array.isArray(book.entries) && book.entries.length > 0) return true;
  }

  // Check unwrapped format
  if (obj.character_book) {
    const book = obj.character_book as Record<string, unknown>;
    if (Array.isArray(book.entries) && book.entries.length > 0) return true;
  }

  return false;
}

/**
 * Check if data looks like a valid card structure
 */
export function looksLikeCard(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;

  // Has explicit spec marker
  if (obj.spec === 'chara_card_v2' || obj.spec === 'chara_card_v3') {
    return true;
  }

  // Has wrapped data with name
  if (obj.data && typeof obj.data === 'object') {
    const dataObj = obj.data as Record<string, unknown>;
    if (typeof dataObj.name === 'string' && dataObj.name.length > 0) {
      return true;
    }
  }

  // Has unwrapped card-like structure
  if (typeof obj.name === 'string' && obj.name.length > 0) {
    if ('description' in obj || 'personality' in obj || 'first_mes' in obj) {
      return true;
    }
  }

  return false;
}
