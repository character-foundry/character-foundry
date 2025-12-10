/**
 * Format Detection
 *
 * Detect card specification version from JSON data.
 */

import type { Spec } from './common.js';

/**
 * V3-only fields that indicate a V3 card
 */
const V3_ONLY_FIELDS = ['group_only_greetings', 'creation_date', 'modification_date', 'assets'] as const;

/**
 * Result from detailed spec detection
 */
export interface SpecDetectionResult {
  /** Detected spec version */
  spec: Spec | null;
  /** Confidence level of detection */
  confidence: 'high' | 'medium' | 'low';
  /** What fields/values indicated this spec */
  indicators: string[];
  /** Anomalies or inconsistencies detected */
  warnings: string[];
}

/**
 * Detect card spec version from parsed JSON
 * Returns 'v2', 'v3', or null if not recognized
 */
export function detectSpec(data: unknown): Spec | null {
  return detectSpecDetailed(data).spec;
}

/**
 * Detailed spec detection with confidence and reasoning.
 * Useful for debugging and logging.
 */
export function detectSpecDetailed(data: unknown): SpecDetectionResult {
  const result: SpecDetectionResult = {
    spec: null,
    confidence: 'low',
    indicators: [],
    warnings: [],
  };

  if (!data || typeof data !== 'object') {
    result.indicators.push('Input is not an object');
    return result;
  }

  const obj = data as Record<string, unknown>;
  const dataObj = (obj.data && typeof obj.data === 'object' ? obj.data : null) as Record<
    string,
    unknown
  > | null;

  // Check for explicit spec markers (HIGH confidence)

  // Explicit v3 spec marker
  if (obj.spec === 'chara_card_v3') {
    result.spec = 'v3';
    result.confidence = 'high';
    result.indicators.push('spec field is "chara_card_v3"');

    // Check for inconsistencies
    if (obj.spec_version && obj.spec_version !== '3.0') {
      result.warnings.push(`spec_version "${obj.spec_version}" inconsistent with v3 spec`);
    }

    return result;
  }

  // Explicit v2 spec marker
  if (obj.spec === 'chara_card_v2') {
    result.spec = 'v2';
    result.confidence = 'high';
    result.indicators.push('spec field is "chara_card_v2"');

    // Check for inconsistencies - V3-only fields in V2 card
    if (dataObj) {
      for (const field of V3_ONLY_FIELDS) {
        if (field in dataObj) {
          result.warnings.push(`V3-only field "${field}" found in V2 card`);
        }
      }
    }

    if (obj.spec_version && obj.spec_version !== '2.0') {
      result.warnings.push(`spec_version "${obj.spec_version}" inconsistent with v2 spec`);
    }

    return result;
  }

  // Check spec_version field (HIGH confidence)
  if (typeof obj.spec_version === 'string') {
    if (obj.spec_version.startsWith('3')) {
      result.spec = 'v3';
      result.confidence = 'high';
      result.indicators.push(`spec_version "${obj.spec_version}" starts with "3"`);
      return result;
    }
    if (obj.spec_version.startsWith('2')) {
      result.spec = 'v2';
      result.confidence = 'high';
      result.indicators.push(`spec_version "${obj.spec_version}" starts with "2"`);
      return result;
    }
  }

  if (obj.spec_version === 2.0 || obj.spec_version === 2) {
    result.spec = 'v2';
    result.confidence = 'high';
    result.indicators.push(`spec_version is numeric ${obj.spec_version}`);
    return result;
  }

  // Check for V3-only fields (MEDIUM confidence)
  if (dataObj) {
    const v3Fields: string[] = [];
    for (const field of V3_ONLY_FIELDS) {
      if (field in dataObj) {
        v3Fields.push(field);
      }
    }

    if (v3Fields.length > 0) {
      result.spec = 'v3';
      result.confidence = 'medium';
      result.indicators.push(`Has V3-only fields: ${v3Fields.join(', ')}`);
      return result;
    }
  }

  // Check root level for V3-only fields (also MEDIUM confidence)
  const rootV3Fields: string[] = [];
  for (const field of V3_ONLY_FIELDS) {
    if (field in obj) {
      rootV3Fields.push(field);
    }
  }
  if (rootV3Fields.length > 0) {
    result.spec = 'v3';
    result.confidence = 'medium';
    result.indicators.push(`Has V3-only fields at root: ${rootV3Fields.join(', ')}`);
    result.warnings.push('V3 fields found at root level instead of data object');
    return result;
  }

  // Wrapped format with data object (MEDIUM confidence)
  if (obj.spec && dataObj) {
    const dataName = dataObj.name;
    if (dataName && typeof dataName === 'string') {
      // Infer from spec string
      if (typeof obj.spec === 'string') {
        if (obj.spec.includes('v3') || obj.spec.includes('3')) {
          result.spec = 'v3';
          result.confidence = 'medium';
          result.indicators.push(`spec field "${obj.spec}" contains "v3" or "3"`);
          return result;
        }
        if (obj.spec.includes('v2') || obj.spec.includes('2')) {
          result.spec = 'v2';
          result.confidence = 'medium';
          result.indicators.push(`spec field "${obj.spec}" contains "v2" or "2"`);
          return result;
        }
      }
      // Default wrapped format to v3 (modern)
      result.spec = 'v3';
      result.confidence = 'medium';
      result.indicators.push('Has wrapped format with spec and data.name');
      return result;
    }
  }

  // Unwrapped format - V1/V2 like structure (MEDIUM confidence)
  if (obj.name && typeof obj.name === 'string') {
    if ('description' in obj || 'personality' in obj || 'scenario' in obj) {
      result.spec = 'v2';
      result.confidence = 'medium';
      result.indicators.push('Unwrapped format with name, description/personality/scenario');
      return result;
    }
  }

  // Check if data object has card-like structure without spec (LOW confidence)
  if (dataObj && typeof dataObj.name === 'string') {
    if ('description' in dataObj || 'personality' in dataObj) {
      result.spec = 'v2';
      result.confidence = 'low';
      result.indicators.push('Has data object with name and card fields, but no spec');
      result.warnings.push('Missing spec field');
      return result;
    }
  }

  result.indicators.push('No card structure detected');
  return result;
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
