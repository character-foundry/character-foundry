/**
 * CRC32 tests
 */

import { describe, it, expect } from 'vitest';
import { crc32, crc32Bytes } from './crc32.js';

describe('CRC32', () => {
  it('calculates correct CRC32 for known value', () => {
    // "IEND" chunk type has known CRC
    const iendType = new Uint8Array([0x49, 0x45, 0x4e, 0x44]); // "IEND"
    const crc = crc32(iendType);

    // Known CRC32 for "IEND" is 0xAE426082
    expect(crc).toBe(0xAE426082);
  });

  it('returns bytes in big-endian order', () => {
    const iendType = new Uint8Array([0x49, 0x45, 0x4e, 0x44]);
    const bytes = crc32Bytes(iendType);

    expect(bytes.length).toBe(4);
    // Big-endian: 0xAE426082 -> [0xAE, 0x42, 0x60, 0x82]
    expect(bytes[0]).toBe(0xAE);
    expect(bytes[1]).toBe(0x42);
    expect(bytes[2]).toBe(0x60);
    expect(bytes[3]).toBe(0x82);
  });

  it('handles empty input', () => {
    const crc = crc32(new Uint8Array([]));
    expect(crc).toBe(0); // CRC of empty data
  });

  it('produces different values for different inputs', () => {
    const a = crc32(new Uint8Array([1, 2, 3]));
    const b = crc32(new Uint8Array([1, 2, 4]));
    expect(a).not.toBe(b);
  });
});
