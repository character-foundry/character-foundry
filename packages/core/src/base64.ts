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

/**
 * Chunk size for encoding large buffers (64KB)
 * Prevents stack overflow when using String.fromCharCode with spread operator
 */
const ENCODE_CHUNK_SIZE = 64 * 1024;

/**
 * Encode binary data to base64 string with chunking for large buffers.
 * Handles buffers >10MB without stack overflow.
 *
 * @param data - Binary data to encode
 * @returns Base64 encoded string
 *
 * @example
 * ```typescript
 * const largeBuffer = new Uint8Array(20 * 1024 * 1024); // 20MB
 * const base64 = encodeChunked(largeBuffer); // No stack overflow
 * ```
 */
export function encodeChunked(data: BinaryData): string {
  if (isNode) {
    // Node.js: Buffer handles large data efficiently
    return Buffer.from(data).toString('base64');
  }

  // Browser: process in chunks to avoid stack overflow
  const chunks: string[] = [];

  for (let i = 0; i < data.length; i += ENCODE_CHUNK_SIZE) {
    const chunk = data.subarray(i, Math.min(i + ENCODE_CHUNK_SIZE, data.length));
    let binary = '';
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]!);
    }
    chunks.push(binary);
  }

  return btoa(chunks.join(''));
}
