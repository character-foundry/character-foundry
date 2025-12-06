/**
 * Binary utilities tests
 */

import { describe, it, expect } from 'vitest';
import {
  concat,
  slice,
  copy,
  indexOf,
  equals,
  fromString,
  toString,
  fromLatin1,
  toLatin1,
  readUInt32BE,
  writeUInt32BE,
  readUInt16BE,
  writeUInt16BE,
  alloc,
  from,
  toHex,
  fromHex,
} from './binary.js';

describe('binary utilities', () => {
  describe('concat', () => {
    it('concatenates multiple arrays', () => {
      const a = new Uint8Array([1, 2]);
      const b = new Uint8Array([3, 4]);
      const c = new Uint8Array([5]);

      const result = concat(a, b, c);
      expect(Array.from(result)).toEqual([1, 2, 3, 4, 5]);
    });

    it('handles empty arrays', () => {
      const a = new Uint8Array([1, 2]);
      const empty = new Uint8Array([]);

      expect(Array.from(concat(a, empty))).toEqual([1, 2]);
      expect(Array.from(concat(empty, a))).toEqual([1, 2]);
    });
  });

  describe('slice', () => {
    it('returns a view of the array', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const sliced = slice(data, 1, 4);

      expect(Array.from(sliced)).toEqual([2, 3, 4]);
      // Verify it's a view (modifying original affects slice)
      data[2] = 99;
      expect(sliced[1]).toBe(99);
    });
  });

  describe('copy', () => {
    it('returns a new array', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const copied = copy(data, 1, 4);

      expect(Array.from(copied)).toEqual([2, 3, 4]);
      // Verify it's a copy (modifying original doesn't affect copy)
      data[2] = 99;
      expect(copied[1]).toBe(3);
    });
  });

  describe('indexOf', () => {
    it('finds byte sequence', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5, 3, 4]);
      const search = new Uint8Array([3, 4]);

      expect(indexOf(data, search)).toBe(2);
      expect(indexOf(data, search, 3)).toBe(5);
    });

    it('returns -1 when not found', () => {
      const data = new Uint8Array([1, 2, 3]);
      const search = new Uint8Array([4, 5]);

      expect(indexOf(data, search)).toBe(-1);
    });
  });

  describe('equals', () => {
    it('compares arrays correctly', () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 3]);
      const c = new Uint8Array([1, 2, 4]);
      const d = new Uint8Array([1, 2]);

      expect(equals(a, b)).toBe(true);
      expect(equals(a, c)).toBe(false);
      expect(equals(a, d)).toBe(false);
    });
  });

  describe('string conversions', () => {
    it('converts UTF-8 strings', () => {
      const str = 'Hello, World!';
      const data = fromString(str);
      expect(toString(data)).toBe(str);
    });

    it('handles unicode', () => {
      const str = 'Hello, 世界! 🌍';
      const data = fromString(str);
      expect(toString(data)).toBe(str);
    });

    it('converts Latin1 strings', () => {
      const str = 'chara';
      const data = fromLatin1(str);
      expect(toLatin1(data)).toBe(str);
    });
  });

  describe('integer operations', () => {
    it('reads/writes 32-bit big-endian', () => {
      const data = alloc(4);
      writeUInt32BE(data, 0x12345678, 0);

      expect(data[0]).toBe(0x12);
      expect(data[1]).toBe(0x34);
      expect(data[2]).toBe(0x56);
      expect(data[3]).toBe(0x78);

      expect(readUInt32BE(data, 0)).toBe(0x12345678);
    });

    it('reads/writes 16-bit big-endian', () => {
      const data = alloc(2);
      writeUInt16BE(data, 0x1234, 0);

      expect(data[0]).toBe(0x12);
      expect(data[1]).toBe(0x34);

      expect(readUInt16BE(data, 0)).toBe(0x1234);
    });
  });

  describe('alloc and from', () => {
    it('allocates zeroed array', () => {
      const data = alloc(5);
      expect(data.length).toBe(5);
      expect(Array.from(data)).toEqual([0, 0, 0, 0, 0]);
    });

    it('creates from number array', () => {
      const data = from([1, 2, 3]);
      expect(data instanceof Uint8Array).toBe(true);
      expect(Array.from(data)).toEqual([1, 2, 3]);
    });
  });

  describe('hex conversions', () => {
    it('converts to hex', () => {
      const data = new Uint8Array([0x12, 0x34, 0xab, 0xcd]);
      expect(toHex(data)).toBe('1234abcd');
    });

    it('converts from hex', () => {
      const data = fromHex('1234abcd');
      expect(Array.from(data)).toEqual([0x12, 0x34, 0xab, 0xcd]);
    });
  });
});
