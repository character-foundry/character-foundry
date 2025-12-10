/**
 * Image Dimensions Detection
 *
 * Get image dimensions without fully decoding the image.
 * Reads only the header bytes needed to determine dimensions.
 */

import { detectImageFormat, type ImageFormat } from './format.js';

/**
 * Image dimensions result
 */
export interface ImageDimensions {
  width: number;
  height: number;
  format: ImageFormat;
}

/**
 * Get image dimensions without fully decoding the image.
 *
 * Reads only the header bytes needed to determine dimensions.
 *
 * @param buffer - Image data
 * @returns Dimensions and format, or null if not recognized
 */
export function getImageDimensions(buffer: Uint8Array): ImageDimensions | null {
  const format = detectImageFormat(buffer);
  if (!format) return null;

  switch (format) {
    case 'png':
      return getPngDimensions(buffer);
    case 'jpeg':
      return getJpegDimensions(buffer);
    case 'gif':
      return getGifDimensions(buffer);
    case 'webp':
      return getWebpDimensions(buffer);
    case 'avif':
      return getAvifDimensions(buffer);
    default:
      return null;
  }
}

/**
 * Get PNG dimensions from IHDR chunk
 */
function getPngDimensions(buffer: Uint8Array): ImageDimensions | null {
  // PNG structure: signature (8 bytes) + IHDR chunk
  // IHDR: length (4) + type (4) + width (4) + height (4) + ...
  if (buffer.length < 24) return null;

  // Verify IHDR chunk type at offset 12
  const ihdr = String.fromCharCode(buffer[12]!, buffer[13]!, buffer[14]!, buffer[15]!);
  if (ihdr !== 'IHDR') return null;

  // Width and height are big-endian at offset 16 and 20
  const width = readUint32BE(buffer, 16);
  const height = readUint32BE(buffer, 20);

  if (width <= 0 || height <= 0) return null;

  return { width, height, format: 'png' };
}

/**
 * Get JPEG dimensions by parsing SOF markers
 */
function getJpegDimensions(buffer: Uint8Array): ImageDimensions | null {
  if (buffer.length < 4) return null;

  let offset = 2; // Skip SOI marker

  while (offset < buffer.length - 8) {
    // Look for marker
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = buffer[offset + 1]!;

    // SOF markers (except SOF4 which is DHT)
    // SOF0-SOF3, SOF5-SOF7, SOF9-SOF11, SOF13-SOF15
    const isSOF =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isSOF) {
      // SOF: FF Cx LL LL P HH HH WW WW
      // Length at offset+2 (2 bytes), precision at offset+4
      // Height at offset+5 (2 bytes), Width at offset+7 (2 bytes)
      if (offset + 9 >= buffer.length) return null;

      const height = readUint16BE(buffer, offset + 5);
      const width = readUint16BE(buffer, offset + 7);

      if (width > 0 && height > 0) {
        return { width, height, format: 'jpeg' };
      }
    }

    // Skip to next marker
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      // Standalone markers
      offset += 2;
    } else if (marker === 0xff) {
      // Padding
      offset++;
    } else {
      // Skip segment
      const segmentLength = readUint16BE(buffer, offset + 2);
      offset += 2 + segmentLength;
    }
  }

  return null;
}

/**
 * Get GIF dimensions from logical screen descriptor
 */
function getGifDimensions(buffer: Uint8Array): ImageDimensions | null {
  // GIF: signature (6) + logical screen descriptor (7)
  // Width at offset 6 (2 bytes LE), Height at offset 8 (2 bytes LE)
  if (buffer.length < 10) return null;

  const width = readUint16LE(buffer, 6);
  const height = readUint16LE(buffer, 8);

  if (width <= 0 || height <= 0) return null;

  return { width, height, format: 'gif' };
}

/**
 * Get WebP dimensions
 */
function getWebpDimensions(buffer: Uint8Array): ImageDimensions | null {
  if (buffer.length < 30) return null;

  // Check for VP8 chunk at offset 12
  const chunk = String.fromCharCode(buffer[12]!, buffer[13]!, buffer[14]!, buffer[15]!);

  if (chunk === 'VP8 ') {
    // Lossy WebP: VP8 bitstream
    // Frame tag at offset 20, then 3-byte frame tag, then dimensions
    if (buffer.length < 30) return null;

    // Skip to frame dimensions (after signature)
    const width = (buffer[26]! | (buffer[27]! << 8)) & 0x3fff;
    const height = (buffer[28]! | (buffer[29]! << 8)) & 0x3fff;

    if (width > 0 && height > 0) {
      return { width, height, format: 'webp' };
    }
  } else if (chunk === 'VP8L') {
    // Lossless WebP
    if (buffer.length < 25) return null;

    // Signature byte at offset 20, then dimensions packed in 4 bytes
    const bits = readUint32LE(buffer, 21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;

    if (width > 0 && height > 0) {
      return { width, height, format: 'webp' };
    }
  } else if (chunk === 'VP8X') {
    // Extended WebP with VP8X chunk
    if (buffer.length < 30) return null;

    // Canvas dimensions at offset 24 (3 bytes each, LE, +1)
    const width =
      (buffer[24]! | (buffer[25]! << 8) | (buffer[26]! << 16)) + 1;
    const height =
      (buffer[27]! | (buffer[28]! << 8) | (buffer[29]! << 16)) + 1;

    if (width > 0 && height > 0) {
      return { width, height, format: 'webp' };
    }
  }

  return null;
}

/**
 * Get AVIF dimensions from ISPE box
 * AVIF uses HEIF container format with ISOBMFF boxes
 */
function getAvifDimensions(buffer: Uint8Array): ImageDimensions | null {
  // This is a simplified parser - AVIF uses complex ISOBMFF structure
  // For a complete implementation, we'd need to parse the full box structure
  // Here we search for the ispe (image spatial extents) box

  if (buffer.length < 32) return null;

  // Search for 'ispe' box marker
  for (let i = 0; i < buffer.length - 16; i++) {
    if (
      buffer[i] === 0x69 && // 'i'
      buffer[i + 1] === 0x73 && // 's'
      buffer[i + 2] === 0x70 && // 'p'
      buffer[i + 3] === 0x65 // 'e'
    ) {
      // Found ispe box, dimensions are at offset +4 (version/flags) +4 (width) +4 (height)
      // ispe structure: type (4) + version (1) + flags (3) + width (4) + height (4)
      const offset = i + 4; // Skip 'ispe'
      if (offset + 12 > buffer.length) continue;

      const width = readUint32BE(buffer, offset + 4);
      const height = readUint32BE(buffer, offset + 8);

      if (width > 0 && height > 0 && width < 65536 && height < 65536) {
        return { width, height, format: 'avif' };
      }
    }
  }

  return null;
}

/**
 * Read big-endian uint32
 */
function readUint32BE(buffer: Uint8Array, offset: number): number {
  return (
    ((buffer[offset]! << 24) |
      (buffer[offset + 1]! << 16) |
      (buffer[offset + 2]! << 8) |
      buffer[offset + 3]!) >>>
    0
  );
}

/**
 * Read big-endian uint16
 */
function readUint16BE(buffer: Uint8Array, offset: number): number {
  return (buffer[offset]! << 8) | buffer[offset + 1]!;
}

/**
 * Read little-endian uint16
 */
function readUint16LE(buffer: Uint8Array, offset: number): number {
  return buffer[offset]! | (buffer[offset + 1]! << 8);
}

/**
 * Read little-endian uint32
 */
function readUint32LE(buffer: Uint8Array, offset: number): number {
  return (
    (buffer[offset]! |
      (buffer[offset + 1]! << 8) |
      (buffer[offset + 2]! << 16) |
      (buffer[offset + 3]! << 24)) >>>
    0
  );
}
