/**
 * Universal Base64 Encoding/Decoding
 *
 * Works in both Node.js and browser environments.
 */

import type { BinaryData } from './binary.js';

/**
 * Check if we're in a Node.js environment
 */
const isNode = typeof process !== 'undefined' &&
  process.versions != null &&
  process.versions.node != null;

/**
 * Encode binary data to base64 string
 */
export function encode(data: BinaryData): string {
  if (isNode) {
    // Node.js: use Buffer
    return Buffer.from(data).toString('base64');
  }

  // Browser: use btoa with binary string conversion
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]!);
  }
  return btoa(binary);
}

/**
 * Decode base64 string to binary data
 */
export function decode(base64: string): BinaryData {
  if (isNode) {
    // Node.js: use Buffer
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }

  // Browser: use atob
  const binary = atob(base64);
  const result = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    result[i] = binary.charCodeAt(i);
  }
  return result;
}

/**
 * Check if a string is valid base64
 */
export function isBase64(str: string): boolean {
  if (str.length === 0) return false;
  // Base64 regex: only valid base64 characters, length multiple of 4 (with padding)
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  return base64Regex.test(str) && str.length % 4 === 0;
}

/**
 * Encode binary data to URL-safe base64 string
 * Replaces + with -, / with _, and removes padding
 */
export function encodeUrlSafe(data: BinaryData): string {
  return encode(data)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decode URL-safe base64 string to binary data
 */
export function decodeUrlSafe(base64: string): BinaryData {
  // Add back padding if needed
  let padded = base64
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  while (padded.length % 4 !== 0) {
    padded += '=';
  }

  return decode(padded);
}
