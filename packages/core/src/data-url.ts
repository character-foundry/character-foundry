/**
 * Data URL Utilities
 *
 * Convert between Uint8Array buffers and data URLs.
 * Handles large buffers (>10MB) without stack overflow by processing in chunks.
 */

import type { BinaryData } from './binary.js';
import { encodeChunked as base64Encode, decode as base64Decode } from './base64.js';
import { ValidationError } from './errors.js';

/**
 * Convert Uint8Array to data URL.
 * Handles large buffers (>10MB) without stack overflow by processing in chunks.
 *
 * @param buffer - Binary data to encode
 * @param mimeType - MIME type for the data URL (e.g., 'image/png', 'application/octet-stream')
 * @returns Data URL string
 *
 * @example
 * ```typescript
 * const png = new Uint8Array([...]);
 * const dataUrl = toDataURL(png, 'image/png');
 * // => "data:image/png;base64,iVBORw0KGgo..."
 * ```
 */
export function toDataURL(buffer: BinaryData, mimeType: string): string {
  // Use chunked encoding to handle large buffers without stack overflow
  const base64 = base64Encode(buffer);
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Parse a data URL back to buffer and MIME type.
 * Validates the data URL format before parsing.
 *
 * @param dataUrl - Data URL string to parse
 * @returns Object containing the decoded buffer and MIME type
 * @throws Error if the data URL format is invalid
 *
 * @example
 * ```typescript
 * const { buffer, mimeType } = fromDataURL('data:image/png;base64,iVBORw0KGgo...');
 * // buffer: Uint8Array
 * // mimeType: 'image/png'
 * ```
 */
export function fromDataURL(dataUrl: string): { buffer: Uint8Array; mimeType: string } {
  // Validate data URL format
  if (!dataUrl.startsWith('data:')) {
    throw new ValidationError('Invalid data URL: must start with "data:"', 'dataUrl');
  }

  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) {
    throw new ValidationError('Invalid data URL: missing comma separator', 'dataUrl');
  }

  const header = dataUrl.slice(5, commaIndex); // Skip 'data:'
  const data = dataUrl.slice(commaIndex + 1);

  // Parse header: [<mediatype>][;base64]
  let mimeType = 'text/plain';
  let isBase64 = false;

  const parts = header.split(';');
  for (const part of parts) {
    if (part === 'base64') {
      isBase64 = true;
    } else if (part && !part.includes('=')) {
      // MIME type (not a parameter like charset=utf-8)
      mimeType = part;
    }
  }

  if (!isBase64) {
    // URL-encoded text data
    throw new ValidationError('Non-base64 data URLs are not supported', 'dataUrl');
  }

  const buffer = base64Decode(data);
  return { buffer, mimeType };
}

/**
 * Check if a string is a valid data URL
 *
 * @param str - String to check
 * @returns true if the string is a valid data URL format
 */
export function isDataURL(str: string): boolean {
  if (!str.startsWith('data:')) return false;
  const commaIndex = str.indexOf(',');
  if (commaIndex === -1) return false;
  const header = str.slice(5, commaIndex);
  return header.includes('base64');
}
