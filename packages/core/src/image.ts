/**
 * Image Analysis Utilities
 *
 * Detect properties of image files from binary data.
 */

import {
  type BinaryData,
  indexOf,
  fromLatin1,
} from './binary.js';

/**
 * Check if an image buffer contains animation data.
 * Supports: APNG, WebP (Animated), GIF
 */
export function isAnimatedImage(data: BinaryData, _mimeType?: string): boolean {
  // 1. WebP Detection
  // RIFF .... WEBP
  if (
    data.length > 12 &&
    data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 && // RIFF
    data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50    // WEBP
  ) {
    // Check for VP8X chunk
    // VP8X chunk header: 'VP8X' (bytes 12-15)
    if (
      data[12] === 0x56 && data[13] === 0x50 && data[14] === 0x38 && data[15] === 0x58
    ) {
      // Flags byte is at offset 20 (16 + 4 bytes chunk size)
      // Animation bit is bit 1 (0x02)
      const flags = data[20];
      return (flags! & 0x02) !== 0;
    }
    return false;
  }

  // 2. PNG/APNG Detection
  // Signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    data.length > 8 &&
    data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47
  ) {
    // Search for 'acTL' chunk (Animation Control)
    // It must appear before IDAT.
    // Simple search: indexOf('acTL')
    // Note: theoretically 'acTL' string could appear in other data, but highly unlikely in valid PNG structure before IDAT
    // We can iterate chunks to be safe, but indexOf is faster for a quick check
    const actlSig = fromLatin1('acTL');
    const idatSig = fromLatin1('IDAT');
    
    const actlIndex = indexOf(data, actlSig);
    if (actlIndex === -1) return false;

    const idatIndex = indexOf(data, idatSig);
    // If acTL exists and is before the first IDAT (or IDAT not found yet), it's APNG
    return idatIndex === -1 || actlIndex < idatIndex;
  }

  // 3. GIF Detection
  // Signature: GIF87a or GIF89a
  if (
    data.length > 6 &&
    data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 // GIF
  ) {
    // Check for NETSCAPE2.0 extension (looping animation)
    // This is a heuristic. Static GIFs are rare in this domain but possible.
    // Full frame counting is expensive. Presence of NETSCAPE block is a strong indicator.
    const netscape = fromLatin1('NETSCAPE2.0');
    return indexOf(data, netscape) !== -1;
  }

  return false;
}
