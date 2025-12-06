/**
 * Binary Data Utilities
 *
 * Universal binary data operations using Uint8Array.
 * Works in both Node.js and browser environments.
 */

/**
 * Universal binary data type (works in both environments)
 */
export type BinaryData = Uint8Array;

/**
 * Read a 32-bit big-endian unsigned integer
 */
export function readUInt32BE(data: BinaryData, offset: number): number {
  return (
    (data[offset]! << 24) |
    (data[offset + 1]! << 16) |
    (data[offset + 2]! << 8) |
    data[offset + 3]!
  ) >>> 0;
}

/**
 * Write a 32-bit big-endian unsigned integer
 */
export function writeUInt32BE(data: BinaryData, value: number, offset: number): void {
  data[offset] = (value >>> 24) & 0xff;
  data[offset + 1] = (value >>> 16) & 0xff;
  data[offset + 2] = (value >>> 8) & 0xff;
  data[offset + 3] = value & 0xff;
}

/**
 * Read a 16-bit big-endian unsigned integer
 */
export function readUInt16BE(data: BinaryData, offset: number): number {
  return ((data[offset]! << 8) | data[offset + 1]!) >>> 0;
}

/**
 * Write a 16-bit big-endian unsigned integer
 */
export function writeUInt16BE(data: BinaryData, value: number, offset: number): void {
  data[offset] = (value >>> 8) & 0xff;
  data[offset + 1] = value & 0xff;
}

/**
 * Find a byte sequence in binary data
 */
export function indexOf(data: BinaryData, search: BinaryData, fromIndex = 0): number {
  outer: for (let i = fromIndex; i <= data.length - search.length; i++) {
    for (let j = 0; j < search.length; j++) {
      if (data[i + j] !== search[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/**
 * Concatenate multiple binary arrays
 */
export function concat(...arrays: BinaryData[]): BinaryData {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Slice binary data (returns a view, not a copy)
 */
export function slice(data: BinaryData, start: number, end?: number): BinaryData {
  return data.subarray(start, end);
}

/**
 * Copy a portion of binary data (returns a new array)
 */
export function copy(data: BinaryData, start: number, end?: number): BinaryData {
  return data.slice(start, end);
}

/**
 * Convert string to binary (UTF-8)
 */
export function fromString(str: string): BinaryData {
  return new TextEncoder().encode(str);
}

/**
 * Convert binary to string (UTF-8)
 */
export function toString(data: BinaryData): string {
  return new TextDecoder().decode(data);
}

/**
 * Convert string to binary (Latin1 - for PNG keywords and similar)
 */
export function fromLatin1(str: string): BinaryData {
  const result = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    result[i] = str.charCodeAt(i) & 0xff;
  }
  return result;
}

/**
 * Convert binary to string (Latin1)
 */
export function toLatin1(data: BinaryData): string {
  let result = '';
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(data[i]!);
  }
  return result;
}

/**
 * Compare two binary arrays for equality
 */
export function equals(a: BinaryData, b: BinaryData): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Create a new Uint8Array filled with zeros
 */
export function alloc(size: number): BinaryData {
  return new Uint8Array(size);
}

/**
 * Create a Uint8Array from an array of numbers
 */
export function from(data: number[] | ArrayBuffer | BinaryData): BinaryData {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  return new Uint8Array(data);
}

/**
 * Check if value is a Uint8Array
 */
export function isBinaryData(value: unknown): value is BinaryData {
  return value instanceof Uint8Array;
}

/**
 * Convert Node.js Buffer to Uint8Array (no-op if already Uint8Array)
 * This provides compatibility when interfacing with Node.js code
 */
export function toUint8Array(data: BinaryData | Buffer): BinaryData {
  if (data instanceof Uint8Array) {
    // Buffer extends Uint8Array, but we want a plain Uint8Array
    // This ensures we get a proper Uint8Array in all cases
    if (Object.getPrototypeOf(data).constructor.name === 'Buffer') {
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
    return data;
  }
  return new Uint8Array(data);
}

/**
 * Convert binary data to hex string
 */
export function toHex(data: BinaryData): string {
  return Array.from(data)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to binary data
 */
export function fromHex(hex: string): BinaryData {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}
