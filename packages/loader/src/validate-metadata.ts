/**
 * Server-side Metadata Validation
 *
 * Validates client-provided metadata against actual parsed card data,
 * supporting optimistic UI while maintaining server authority.
 *
 * @example
 * ```typescript
 * import { validateClientMetadata } from '@character-foundry/loader';
 *
 * // Client sends metadata with upload
 * const clientMeta = {
 *   name: 'My Character',
 *   tokens: { description: 150, total: 500 },
 *   contentHash: 'abc123',
 *   hasLorebook: true,
 *   lorebookEntriesCount: 5,
 * };
 *
 * // Server parses and validates
 * const result = await validateClientMetadata(clientMeta, parseResult);
 *
 * if (!result.isValid) {
 *   // Client metadata has significant discrepancies
 *   console.warn('Metadata discrepancies:', result.discrepancies);
 * }
 *
 * // Use authoritative values
 * const trustedMeta = result.authoritative;
 * ```
 */

import type { CCv3Data } from '@character-foundry/schemas';
import type { ParseResult } from './types.js';

/**
 * Token counts for a character card
 * Must match @character-foundry/tokenizers CardTokenCounts
 */
export interface TokenCounts {
  description: number;
  personality: number;
  scenario: number;
  firstMes: number;
  mesExample: number;
  systemPrompt: number;
  postHistoryInstructions: number;
  alternateGreetings: number;
  lorebook: number;
  creatorNotes: number;
  total: number;
}

/**
 * Client-provided metadata submitted with upload
 */
export interface ClientMetadata {
  /** Character name */
  name: string;
  /** Character description (for display) */
  description?: string;
  /** Token counts computed client-side */
  tokens: Partial<TokenCounts>;
  /** Content hash computed client-side */
  contentHash: string;
  /** User-supplied tags */
  tags?: string[];
  /** Whether the card has a lorebook */
  hasLorebook: boolean;
  /** Number of lorebook entries */
  lorebookEntriesCount: number;
}

/**
 * A discrepancy between client and server values
 */
export interface MetadataDiscrepancy {
  /** Field that differs */
  field: string;
  /** Value provided by client */
  clientValue: unknown;
  /** Value computed by server */
  computedValue: unknown;
  /** Whether this discrepancy is within tolerance */
  withinTolerance: boolean;
}

/**
 * Authoritative metadata computed by server
 */
export interface AuthoritativeMetadata {
  /** Character name from card */
  name: string;
  /** Token counts computed server-side */
  tokens: TokenCounts;
  /** Content hash computed server-side */
  contentHash: string;
  /**
   * Content hash v2 computed server-side.
   *
   * @remarks
   * v1 is preserved for backwards compatibility. Prefer v2 for new storage/deduplication.
   */
  contentHashV2?: string;
  /** Whether the card has a lorebook */
  hasLorebook: boolean;
  /** Number of lorebook entries */
  lorebookEntriesCount: number;
}

/**
 * Result of metadata validation
 */
export interface ValidationResult {
  /** Whether client metadata is valid (no significant discrepancies) */
  isValid: boolean;
  /** Whether client can be fully trusted (no discrepancies at all) */
  isTrusted: boolean;
  /** List of discrepancies found */
  discrepancies: MetadataDiscrepancy[];
  /** Server-computed authoritative values */
  authoritative: AuthoritativeMetadata;
  /** Warning messages (non-blocking) */
  warnings: string[];
  /** Error messages (blocking) */
  errors: string[];
}

/**
 * Tag validation function signature
 */
export type TagValidator = (tags: string[]) => {
  valid: boolean;
  filtered: string[];
  reason?: string;
};

/**
 * Options for metadata validation
 */
export interface ValidationOptions {
  /**
   * Tolerance for token count differences (default: 5%)
   * Differences within this percentage are considered acceptable.
   */
  tokenTolerance?: number;

  /**
   * Allow hash mismatches without marking as invalid (default: false)
   * When true, hash mismatches are only warnings.
   */
  allowHashMismatch?: boolean;

  /**
   * Custom tag validation function
   * Called to filter/validate user-provided tags.
   */
  validateTags?: TagValidator;

  /**
   * Custom token counter function
   * If provided, this is used instead of a built-in counter.
   * Signature matches @character-foundry/tokenizers countCardTokens
   */
  countTokens?: (card: CCv3Data) => TokenCounts;

  /**
   * Custom content hash function
   * If provided, this is used instead of the default SHA-256 hash.
   */
  computeHash?: (content: string) => Promise<string> | string;
}

/**
 * Default SHA-256 hash using Web Crypto API
 * Works in Node.js 18+, browsers, and Cloudflare Workers
 */
async function sha256Hash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Default token counter that returns zeros
 * Users should provide their own counter via options.countTokens
 * to get accurate counts (avoids bundling tiktoken dependency)
 */
function defaultTokenCounter(_card: CCv3Data): TokenCounts {
  return {
    description: 0,
    personality: 0,
    scenario: 0,
    firstMes: 0,
    mesExample: 0,
    systemPrompt: 0,
    postHistoryInstructions: 0,
    alternateGreetings: 0,
    lorebook: 0,
    creatorNotes: 0,
    total: 0,
  };
}

/**
 * Compute canonical content hash from card data
 * Uses sorted JSON keys for consistent hashing
 */
function getCanonicalContentV1(card: CCv3Data): string {
  // Create a normalized version for hashing
  const normalized = {
    name: card.data.name,
    description: card.data.description || '',
    personality: card.data.personality || '',
    scenario: card.data.scenario || '',
    first_mes: card.data.first_mes || '',
    mes_example: card.data.mes_example || '',
    system_prompt: card.data.system_prompt || '',
    post_history_instructions: card.data.post_history_instructions || '',
    alternate_greetings: card.data.alternate_greetings || [],
    character_book: card.data.character_book
      ? {
          entries: (card.data.character_book.entries || []).map((e) => ({
            keys: e.keys,
            content: e.content,
            enabled: e.enabled,
          })),
        }
      : null,
    creator_notes: card.data.creator_notes || '',
  };

  return JSON.stringify(normalized, Object.keys(normalized).sort());
}

/**
 * Stable JSON stringify with deterministic key ordering (recursive).
 *
 * @remarks
 * This intentionally mirrors JSON.stringify semantics for unsupported values:
 * - Object properties with `undefined` are omitted
 * - Array elements with `undefined` become `null`
 */
function stableStringify(value: unknown): string {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'number':
      return Number.isFinite(value) ? String(value) : 'null';
    case 'boolean':
      return value ? 'true' : 'false';
    case 'bigint':
      // JSON doesn't support bigint - encode as string for stability
      return JSON.stringify(value.toString());
    case 'undefined':
    case 'function':
    case 'symbol':
      return 'null';
    case 'object': {
      if (Array.isArray(value)) {
        const parts = value.map((item) => {
          if (item === undefined || typeof item === 'function' || typeof item === 'symbol') {
            return 'null';
          }
          return stableStringify(item);
        });
        return `[${parts.join(',')}]`;
      }

      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj).sort();
      const parts: string[] = [];

      for (const key of keys) {
        const v = obj[key];
        if (v === undefined || typeof v === 'function' || typeof v === 'symbol') {
          continue;
        }
        parts.push(`${JSON.stringify(key)}:${stableStringify(v)}`);
      }

      return `{${parts.join(',')}}`;
    }
    default:
      return 'null';
  }
}

/**
 * Canonical content for hashing v2.
 *
 * @remarks
 * v1 used JSON.stringify with a replacer array which unintentionally filtered nested keys.
 * v2 uses a stable recursive stringify to preserve nested content deterministically.
 */
function getCanonicalContentV2(card: CCv3Data): string {
  const normalized = {
    name: card.data.name,
    description: card.data.description || '',
    personality: card.data.personality || '',
    scenario: card.data.scenario || '',
    first_mes: card.data.first_mes || '',
    mes_example: card.data.mes_example || '',
    system_prompt: card.data.system_prompt || '',
    post_history_instructions: card.data.post_history_instructions || '',
    alternate_greetings: card.data.alternate_greetings || [],
    character_book: card.data.character_book
      ? {
          entries: (card.data.character_book.entries || []).map((e) => ({
            keys: e.keys,
            content: e.content,
            enabled: e.enabled,
          })),
        }
      : null,
    creator_notes: card.data.creator_notes || '',
  };

  return stableStringify(normalized);
}

/**
 * Check if two token counts are within tolerance
 */
function isWithinTolerance(
  clientValue: number | undefined,
  computedValue: number,
  tolerance: number
): boolean {
  if (clientValue === undefined) return false;
  if (computedValue === 0) return clientValue === 0;
  const diff = Math.abs(clientValue - computedValue);
  const percentDiff = diff / computedValue;
  return percentDiff <= tolerance;
}

/**
 * Validate client-provided metadata against parsed card data
 *
 * This function ensures server authority over critical fields like
 * token counts and content hashes while supporting optimistic UI.
 *
 * @param clientMetadata - Metadata provided by the client
 * @param parseResult - Result from parseCard()
 * @param options - Validation options
 * @returns Validation result with authoritative values
 *
 * @example
 * ```typescript
 * import { parseCard, validateClientMetadata } from '@character-foundry/loader';
 * import { countCardTokens } from '@character-foundry/tokenizers';
 *
 * const parseResult = parseCard(buffer);
 * const result = await validateClientMetadata(clientMeta, parseResult, {
 *   countTokens: (card) => countCardTokens(card),
 *   tokenTolerance: 0.05, // 5% tolerance
 * });
 *
 * // Use authoritative values for storage
 * await db.insert({
 *   ...clientMeta,
 *   tokens: result.authoritative.tokens,
 *   contentHash: result.authoritative.contentHash,
 * });
 * ```
 */
export async function validateClientMetadata(
  clientMetadata: ClientMetadata,
  parseResult: ParseResult,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const {
    tokenTolerance = 0.05,
    allowHashMismatch = false,
    validateTags,
    countTokens = defaultTokenCounter,
    computeHash = sha256Hash,
  } = options;

  const card = parseResult.card;
  const discrepancies: MetadataDiscrepancy[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  // Compute authoritative token counts
  const computedTokens = countTokens(card);

  // Compute authoritative content hash
  const canonicalContentV1 = getCanonicalContentV1(card);
  const canonicalContentV2 = getCanonicalContentV2(card);
  const computedHashV1 = await computeHash(canonicalContentV1);
  const computedHashV2 = await computeHash(canonicalContentV2);

  // Compute authoritative lorebook info
  const entries = card.data.character_book?.entries || [];
  const computedHasLorebook = entries.length > 0;
  const computedLorebookCount = entries.length;

  // Build authoritative metadata
  const authoritative: AuthoritativeMetadata = {
    name: card.data.name,
    tokens: computedTokens,
    contentHash: computedHashV1,
    contentHashV2: computedHashV2,
    hasLorebook: computedHasLorebook,
    lorebookEntriesCount: computedLorebookCount,
  };

  // Validate name
  if (clientMetadata.name !== card.data.name) {
    discrepancies.push({
      field: 'name',
      clientValue: clientMetadata.name,
      computedValue: card.data.name,
      withinTolerance: false,
    });
  }

  // Validate content hash
  const matchesV1 = clientMetadata.contentHash === computedHashV1;
  const matchesV2 = clientMetadata.contentHash === computedHashV2;

  if (!matchesV1 && !matchesV2) {
    const disc: MetadataDiscrepancy = {
      field: 'contentHash',
      clientValue: clientMetadata.contentHash,
      computedValue: computedHashV1,
      withinTolerance: false,
    };
    discrepancies.push(disc);

    if (allowHashMismatch) {
      warnings.push(
        `Content hash mismatch: client=${clientMetadata.contentHash.substring(0, 8)}..., ` +
          `server(v1)=${computedHashV1.substring(0, 8)}..., ` +
          `server(v2)=${computedHashV2.substring(0, 8)}...`
      );
    } else {
      errors.push('Content hash mismatch - possible tampering or encoding difference');
    }
  } else if (matchesV1 && !matchesV2) {
    warnings.push(
      'Client contentHash matches legacy v1 canonicalization. Prefer authoritative.contentHashV2 for new storage.'
    );
  }

  // Validate token counts
  const tokenFields: (keyof TokenCounts)[] = [
    'description',
    'personality',
    'scenario',
    'firstMes',
    'mesExample',
    'systemPrompt',
    'postHistoryInstructions',
    'alternateGreetings',
    'lorebook',
    'creatorNotes',
    'total',
  ];

  for (const field of tokenFields) {
    const clientValue = clientMetadata.tokens[field];
    const computedValue = computedTokens[field];

    if (clientValue !== undefined && clientValue !== computedValue) {
      const withinTolerance = isWithinTolerance(clientValue, computedValue, tokenTolerance);

      discrepancies.push({
        field: `tokens.${field}`,
        clientValue,
        computedValue,
        withinTolerance,
      });

      if (!withinTolerance && computedValue > 0) {
        const percentDiff = Math.abs(clientValue - computedValue) / computedValue;
        warnings.push(
          `Token count mismatch for ${field}: client=${clientValue}, server=${computedValue} ` +
            `(${(percentDiff * 100).toFixed(1)}% difference)`
        );
      }
    }
  }

  // Validate lorebook presence
  if (clientMetadata.hasLorebook !== computedHasLorebook) {
    discrepancies.push({
      field: 'hasLorebook',
      clientValue: clientMetadata.hasLorebook,
      computedValue: computedHasLorebook,
      withinTolerance: false,
    });
    errors.push(
      `Lorebook presence mismatch: client=${clientMetadata.hasLorebook}, server=${computedHasLorebook}`
    );
  }

  // Validate lorebook entry count
  if (clientMetadata.lorebookEntriesCount !== computedLorebookCount) {
    discrepancies.push({
      field: 'lorebookEntriesCount',
      clientValue: clientMetadata.lorebookEntriesCount,
      computedValue: computedLorebookCount,
      withinTolerance: false,
    });
    warnings.push(
      `Lorebook entry count mismatch: client=${clientMetadata.lorebookEntriesCount}, server=${computedLorebookCount}`
    );
  }

  // Validate tags if validator provided
  if (validateTags && clientMetadata.tags) {
    const tagResult = validateTags(clientMetadata.tags);
    if (!tagResult.valid) {
      errors.push(tagResult.reason || 'Invalid tags');
    }
    if (tagResult.filtered.length !== clientMetadata.tags.length) {
      const filtered = clientMetadata.tags.filter((t) => !tagResult.filtered.includes(t));
      warnings.push(`Some tags were filtered: ${filtered.join(', ')}`);
    }
  }

  // Determine validity
  const hasBlockingDiscrepancies = discrepancies.some(
    (d) =>
      !d.withinTolerance &&
      (d.field === 'contentHash' && !allowHashMismatch ||
        d.field === 'hasLorebook' ||
        d.field === 'name')
  );

  const isValid = errors.length === 0 && !hasBlockingDiscrepancies;
  const isTrusted = discrepancies.length === 0;

  return {
    isValid,
    isTrusted,
    discrepancies,
    authoritative,
    warnings,
    errors,
  };
}

/**
 * Compute content hash for a card (standalone utility)
 *
 * @param card - CCv3 card data
 * @returns SHA-256 hash of canonical content
 */
export async function computeContentHash(card: CCv3Data): Promise<string> {
  const content = getCanonicalContentV1(card);
  return sha256Hash(content);
}

/**
 * Compute content hash v2 for a card (standalone utility)
 *
 * @param card - CCv3 card data
 * @returns SHA-256 hash of canonical content v2
 */
export async function computeContentHashV2(card: CCv3Data): Promise<string> {
  const content = getCanonicalContentV2(card);
  return sha256Hash(content);
}

/**
 * Options for synchronous metadata validation
 */
export interface SyncValidationOptions extends Omit<ValidationOptions, 'computeHash'> {
  /**
   * Synchronous content hash function (required for sync version)
   */
  computeHash: (content: string) => string;
}

/**
 * Sync version of validateClientMetadata
 * Requires a synchronous hash function to be provided
 */
export function validateClientMetadataSync(
  clientMetadata: ClientMetadata,
  parseResult: ParseResult,
  options: SyncValidationOptions
): ValidationResult {
  const {
    tokenTolerance = 0.05,
    allowHashMismatch = false,
    validateTags,
    countTokens = defaultTokenCounter,
    computeHash,
  } = options;

  const card = parseResult.card;
  const discrepancies: MetadataDiscrepancy[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const computedTokens = countTokens(card);
  const canonicalContentV1 = getCanonicalContentV1(card);
  const canonicalContentV2 = getCanonicalContentV2(card);
  const computedHashV1 = computeHash(canonicalContentV1);
  const computedHashV2 = computeHash(canonicalContentV2);

  const entries = card.data.character_book?.entries || [];
  const computedHasLorebook = entries.length > 0;
  const computedLorebookCount = entries.length;

  const authoritative: AuthoritativeMetadata = {
    name: card.data.name,
    tokens: computedTokens,
    contentHash: computedHashV1,
    contentHashV2: computedHashV2,
    hasLorebook: computedHasLorebook,
    lorebookEntriesCount: computedLorebookCount,
  };

  // Name validation
  if (clientMetadata.name !== card.data.name) {
    discrepancies.push({
      field: 'name',
      clientValue: clientMetadata.name,
      computedValue: card.data.name,
      withinTolerance: false,
    });
  }

  // Hash validation
  const matchesV1 = clientMetadata.contentHash === computedHashV1;
  const matchesV2 = clientMetadata.contentHash === computedHashV2;

  if (!matchesV1 && !matchesV2) {
    discrepancies.push({
      field: 'contentHash',
      clientValue: clientMetadata.contentHash,
      computedValue: computedHashV1,
      withinTolerance: false,
    });

    if (allowHashMismatch) {
      warnings.push(`Content hash mismatch`);
    } else {
      errors.push('Content hash mismatch');
    }
  } else if (matchesV1 && !matchesV2) {
    warnings.push(
      'Client contentHash matches legacy v1 canonicalization. Prefer authoritative.contentHashV2 for new storage.'
    );
  }

  // Token validation
  const tokenFields: (keyof TokenCounts)[] = [
    'description',
    'personality',
    'scenario',
    'firstMes',
    'mesExample',
    'systemPrompt',
    'postHistoryInstructions',
    'alternateGreetings',
    'lorebook',
    'creatorNotes',
    'total',
  ];

  for (const field of tokenFields) {
    const clientValue = clientMetadata.tokens[field];
    const computedValue = computedTokens[field];

    if (clientValue !== undefined && clientValue !== computedValue) {
      const withinTolerance = isWithinTolerance(clientValue, computedValue, tokenTolerance);
      discrepancies.push({
        field: `tokens.${field}`,
        clientValue,
        computedValue,
        withinTolerance,
      });

      if (!withinTolerance && computedValue > 0) {
        warnings.push(`Token count mismatch for ${field}`);
      }
    }
  }

  // Lorebook validation
  if (clientMetadata.hasLorebook !== computedHasLorebook) {
    discrepancies.push({
      field: 'hasLorebook',
      clientValue: clientMetadata.hasLorebook,
      computedValue: computedHasLorebook,
      withinTolerance: false,
    });
    errors.push('Lorebook presence mismatch');
  }

  if (clientMetadata.lorebookEntriesCount !== computedLorebookCount) {
    discrepancies.push({
      field: 'lorebookEntriesCount',
      clientValue: clientMetadata.lorebookEntriesCount,
      computedValue: computedLorebookCount,
      withinTolerance: false,
    });
    warnings.push('Lorebook entry count mismatch');
  }

  // Tag validation
  if (validateTags && clientMetadata.tags) {
    const tagResult = validateTags(clientMetadata.tags);
    if (!tagResult.valid) {
      errors.push(tagResult.reason || 'Invalid tags');
    }
  }

  const hasBlockingDiscrepancies = discrepancies.some(
    (d) =>
      !d.withinTolerance &&
      (d.field === 'contentHash' && !allowHashMismatch ||
        d.field === 'hasLorebook' ||
        d.field === 'name')
  );

  return {
    isValid: errors.length === 0 && !hasBlockingDiscrepancies,
    isTrusted: discrepancies.length === 0,
    discrepancies,
    authoritative,
    warnings,
    errors,
  };
}
