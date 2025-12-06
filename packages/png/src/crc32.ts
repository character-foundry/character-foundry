/**
 * CRC32 Implementation for PNG Chunks
 *
 * Pure JavaScript implementation using the standard polynomial.
 */

import { type BinaryData, alloc, writeUInt32BE } from '@character-foundry/core';

// Pre-computed CRC table for faster calculation
let CRC_TABLE: Uint32Array | null = null;

/**
 * Build the CRC lookup table (lazy initialization)
 */
function getCRCTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE;

  CRC_TABLE = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    CRC_TABLE[i] = c;
  }
  return CRC_TABLE;
}

/**
 * Calculate CRC32 checksum for a PNG chunk
 * @param data - Binary data to calculate CRC for
 * @returns CRC32 value as a number
 */
export function crc32(data: BinaryData): number {
  const table = getCRCTable();
  let crc = 0xFFFFFFFF;

  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]!) & 0xFF]! ^ (crc >>> 8);
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Calculate CRC32 and return as a 4-byte big-endian Uint8Array
 * @param data - Binary data to calculate CRC for
 * @returns 4-byte Uint8Array containing CRC32 in big-endian format
 */
export function crc32Bytes(data: BinaryData): BinaryData {
  const crc = crc32(data);
  const result = alloc(4);
  writeUInt32BE(result, crc, 0);
  return result;
}
