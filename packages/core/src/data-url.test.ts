/**
 * Data URL Tests
 */

import { describe, it, expect } from 'vitest';
import { toDataURL, fromDataURL, isDataURL } from './data-url.js';

describe('toDataURL', () => {
  it('should encode small buffer to data URL', () => {
    const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const result = toDataURL(data, 'image/png');

    expect(result).toMatch(/^data:image\/png;base64,/);
    expect(result).toBe('data:image/png;base64,iVBORw==');
  });

  it('should handle empty buffer', () => {
    const data = new Uint8Array(0);
    const result = toDataURL(data, 'application/octet-stream');

    expect(result).toBe('data:application/octet-stream;base64,');
  });

  it('should handle large buffer without stack overflow', () => {
    // Create 2MB buffer (larger than typical stack limit issues)
    const size = 2 * 1024 * 1024;
    const data = new Uint8Array(size);
    // Fill with pattern for verification
    for (let i = 0; i < size; i++) {
      data[i] = i % 256;
    }

    // Should not throw
    const result = toDataURL(data, 'application/octet-stream');

    expect(result).toMatch(/^data:application\/octet-stream;base64,/);
    expect(result.length).toBeGreaterThan(size); // Base64 is larger than binary
  });
});

describe('fromDataURL', () => {
  it('should decode data URL back to buffer', () => {
    const dataUrl = 'data:image/png;base64,iVBORw==';
    const { buffer, mimeType } = fromDataURL(dataUrl);

    expect(buffer).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    expect(mimeType).toBe('image/png');
  });

  it('should handle empty data', () => {
    const dataUrl = 'data:text/plain;base64,';
    const { buffer, mimeType } = fromDataURL(dataUrl);

    expect(buffer).toEqual(new Uint8Array(0));
    expect(mimeType).toBe('text/plain');
  });

  it('should throw on invalid prefix', () => {
    expect(() => fromDataURL('http://example.com')).toThrow('Invalid data URL');
  });

  it('should throw on missing comma', () => {
    expect(() => fromDataURL('data:image/png;base64')).toThrow('missing comma');
  });

  it('should throw on non-base64 data URL', () => {
    expect(() => fromDataURL('data:text/plain,hello')).toThrow('Non-base64');
  });

  it('should round-trip large buffer', () => {
    // Create 1MB buffer with pattern
    const size = 1024 * 1024;
    const original = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      original[i] = i % 256;
    }

    const dataUrl = toDataURL(original, 'application/octet-stream');
    const { buffer, mimeType } = fromDataURL(dataUrl);

    expect(mimeType).toBe('application/octet-stream');
    expect(buffer.length).toBe(original.length);
    expect(buffer).toEqual(original);
  });
});

describe('isDataURL', () => {
  it('should return true for valid data URLs', () => {
    expect(isDataURL('data:image/png;base64,iVBORw==')).toBe(true);
    expect(isDataURL('data:text/plain;base64,SGVsbG8=')).toBe(true);
  });

  it('should return false for non-data URLs', () => {
    expect(isDataURL('http://example.com')).toBe(false);
    expect(isDataURL('file:///path/to/file')).toBe(false);
    expect(isDataURL('')).toBe(false);
  });

  it('should return false for data URL without base64', () => {
    expect(isDataURL('data:text/plain,hello')).toBe(false);
  });

  it('should return false for malformed data URLs', () => {
    expect(isDataURL('data:image/png')).toBe(false);
  });
});
