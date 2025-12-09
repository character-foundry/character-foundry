/**
 * Security-focused tests for core utilities
 */

import { describe, it, expect } from 'vitest';
import { zipSync } from 'fflate';
import {
  preflightZipSizes,
  ZipPreflightError,
  DEFAULT_ZIP_LIMITS,
} from './zip.js';
import {
  generateUUID,
  isValidUUID,
} from './uuid.js';
import {
  toDataURL,
  fromDataURL,
  isDataURL,
} from './data-url.js';
import {
  encode as base64Encode,
  encodeChunked as base64EncodeChunked,
} from './base64.js';

describe('ZIP bomb mitigation', () => {
  it('should pass preflight for normal ZIP files', () => {
    const files = {
      'test.txt': new TextEncoder().encode('Hello World'),
      'data.json': new TextEncoder().encode('{"name": "test"}'),
    };
    const zipData = zipSync(files);

    const result = preflightZipSizes(zipData);
    expect(result.totalUncompressedSize).toBeGreaterThan(0);
    expect(result.fileCount).toBe(2);
  });

  it('should reject ZIP with oversized total uncompressed size', () => {
    // Create a ZIP that claims to have huge uncompressed content
    // We can't easily create a true zip bomb, but we can test the logic
    const files = {
      'test.txt': new TextEncoder().encode('x'.repeat(1000)),
    };
    const zipData = zipSync(files);

    // Test with very low limits
    expect(() => {
      preflightZipSizes(zipData, {
        maxFileSize: 100, // Only 100 bytes max per file
        maxTotalSize: 200,
        maxFiles: 10,
      });
    }).toThrow(ZipPreflightError);
  });

  it('should reject ZIP with too many files', () => {
    const files: Record<string, Uint8Array> = {};
    for (let i = 0; i < 10; i++) {
      files[`file${i}.txt`] = new TextEncoder().encode('x');
    }
    const zipData = zipSync(files);

    expect(() => {
      preflightZipSizes(zipData, {
        maxFileSize: DEFAULT_ZIP_LIMITS.maxFileSize,
        maxTotalSize: DEFAULT_ZIP_LIMITS.maxTotalSize,
        maxFiles: 5, // Only allow 5 files
      });
    }).toThrow(ZipPreflightError);
  });

  it('should return correct file count and sizes', () => {
    const content1 = new TextEncoder().encode('Hello');
    const content2 = new TextEncoder().encode('World!');
    const files = {
      'file1.txt': content1,
      'file2.txt': content2,
    };
    const zipData = zipSync(files);

    const result = preflightZipSizes(zipData);
    expect(result.fileCount).toBe(2);
    // Uncompressed sizes should match original content
    expect(result.totalUncompressedSize).toBe(content1.length + content2.length);
  });

  it('should throw ZipPreflightError with useful details', () => {
    const files = {
      'big.txt': new TextEncoder().encode('x'.repeat(500)),
    };
    const zipData = zipSync(files);

    try {
      preflightZipSizes(zipData, {
        maxFileSize: 100,
        maxTotalSize: 1000,
        maxFiles: 10,
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ZipPreflightError);
      const preflight = err as ZipPreflightError;
      expect(preflight.oversizedEntry).toBe('big.txt');
      expect(preflight.entrySize).toBe(500);
      expect(preflight.maxEntrySize).toBe(100);
    }
  });
});

describe('Crypto-grade UUID', () => {
  it('should generate valid UUID v4 format', () => {
    const uuid = generateUUID();
    expect(isValidUUID(uuid)).toBe(true);
  });

  it('should generate unique UUIDs', () => {
    const uuids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      uuids.add(generateUUID());
    }
    expect(uuids.size).toBe(100);
  });

  it('should produce UUIDs with correct version nibble', () => {
    const uuid = generateUUID();
    // Version 4 UUIDs have '4' as the 13th character
    expect(uuid[14]).toBe('4');
  });

  it('should produce UUIDs with correct variant bits', () => {
    const uuid = generateUUID();
    // Variant 1 UUIDs have 8, 9, a, or b as the 17th character
    const variant = uuid[19]!.toLowerCase();
    expect(['8', '9', 'a', 'b']).toContain(variant);
  });

  it('should validate correct UUIDs', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUUID('6ba7b810-9dad-41d8-80b4-00c04fd430c8')).toBe(true);
  });

  it('should reject invalid UUIDs', () => {
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('550e8400-e29b-51d4-a716-446655440000')).toBe(false); // Version 5 not 4
    expect(isValidUUID('550e8400-e29b-41d4-c716-446655440000')).toBe(false); // Wrong variant
    expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000')).toBe(false); // Too short
    expect(isValidUUID('550e8400-e29b-41d4-a716-4466554400000')).toBe(false); // Too long
  });
});

describe('Data URL utilities', () => {
  it('should create valid data URLs', () => {
    const data = new TextEncoder().encode('Hello World');
    const dataUrl = toDataURL(data, 'text/plain');

    expect(dataUrl).toMatch(/^data:text\/plain;base64,/);
    expect(isDataURL(dataUrl)).toBe(true);
  });

  it('should round-trip data correctly', () => {
    const original = new Uint8Array([0, 1, 2, 255, 128, 64]);
    const dataUrl = toDataURL(original, 'application/octet-stream');
    const { buffer, mimeType } = fromDataURL(dataUrl);

    expect(mimeType).toBe('application/octet-stream');
    expect(Array.from(buffer)).toEqual(Array.from(original));
  });

  it('should reject non-base64 data URLs', () => {
    expect(() => fromDataURL('data:text/plain,Hello')).toThrow('not supported');
  });

  it('should reject invalid data URL formats', () => {
    expect(() => fromDataURL('not a data url')).toThrow();
    expect(() => fromDataURL('data:no-comma')).toThrow();
  });

  it('should detect data URLs correctly', () => {
    expect(isDataURL('data:text/plain;base64,SGVsbG8=')).toBe(true);
    expect(isDataURL('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isDataURL('not a data url')).toBe(false);
    expect(isDataURL('data:text/plain,Hello')).toBe(false); // No base64
  });
});

describe('Base64 chunked encoding', () => {
  it('should encode small buffers correctly', () => {
    const data = new TextEncoder().encode('Hello World');
    const regular = base64Encode(data);
    const chunked = base64EncodeChunked(data);

    expect(chunked).toBe(regular);
  });

  it('should handle empty buffers', () => {
    const data = new Uint8Array(0);
    const result = base64EncodeChunked(data);
    expect(result).toBe('');
  });

  it('should encode larger buffers correctly', () => {
    // Create a 1MB buffer
    const data = new Uint8Array(1024 * 1024);
    for (let i = 0; i < data.length; i++) {
      data[i] = i % 256;
    }

    const regular = base64Encode(data);
    const chunked = base64EncodeChunked(data);

    expect(chunked).toBe(regular);
  });
});
