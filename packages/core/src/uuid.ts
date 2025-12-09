/**
 * UUID Generation Utilities
 *
 * Provides crypto-grade UUID v4 generation that works in Node.js,
 * browsers (secure contexts), and falls back gracefully.
 */

/**
 * Format 16 random bytes as a UUID v4 string
 */
function formatUUID(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Fallback UUID generation using Math.random()
 * Only used when crypto APIs are unavailable (rare)
 */
function mathRandomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a cryptographically secure UUID v4.
 *
 * Uses crypto.randomUUID() when available (Node.js 19+, modern browsers).
 * Falls back to crypto.getRandomValues() if randomUUID is unavailable.
 * Last resort uses Math.random() (non-secure, emits warning in dev).
 *
 * @returns A valid RFC 4122 UUID v4 string
 *
 * @example
 * ```typescript
 * const id = generateUUID();
 * // => "550e8400-e29b-41d4-a716-446655440000"
 * ```
 */
export function generateUUID(): string {
  // Node.js 19+ or browser with secure context
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback using crypto.getRandomValues (older Node/browsers)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set version (4) and variant (RFC 4122)
    bytes[6] = (bytes[6]! & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8]! & 0x3f) | 0x80; // Variant 1
    return formatUUID(bytes);
  }

  // Last resort - non-secure fallback
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    console.warn('[character-foundry/core] generateUUID: Using insecure Math.random() fallback');
  }
  return mathRandomUUID();
}

/**
 * Validate if a string is a valid UUID v4
 *
 * @param uuid - String to validate
 * @returns true if valid UUID v4 format
 */
export function isValidUUID(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}
