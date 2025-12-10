/**
 * Image Format Detection
 *
 * Detect image format from magic bytes.
 */

/**
 * Supported image formats
 */
export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'avif';

/**
 * Magic bytes for each format
 */
const MAGIC_BYTES: Record<ImageFormat, { bytes: number[]; offset?: number; check?: number[] }> = {
  png: { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  jpeg: { bytes: [0xff, 0xd8, 0xff] },
  gif: { bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  webp: { bytes: [0x52, 0x49, 0x46, 0x46], offset: 8, check: [0x57, 0x45, 0x42, 0x50] }, // RIFF....WEBP
  avif: { bytes: [0x00, 0x00, 0x00], offset: 4, check: [0x66, 0x74, 0x79, 0x70] }, // ....ftyp (then check for avif/avis)
};

/**
 * Detect image format from magic bytes.
 *
 * @param buffer - Image data
 * @returns Detected format, or null if not recognized
 */
export function detectImageFormat(buffer: Uint8Array): ImageFormat | null {
  if (buffer.length < 12) return null;

  // Check PNG
  if (matchesBytes(buffer, MAGIC_BYTES.png.bytes)) {
    return 'png';
  }

  // Check JPEG
  if (matchesBytes(buffer, MAGIC_BYTES.jpeg.bytes)) {
    return 'jpeg';
  }

  // Check GIF
  if (matchesBytes(buffer, MAGIC_BYTES.gif.bytes)) {
    return 'gif';
  }

  // Check WebP (RIFF....WEBP)
  if (
    matchesBytes(buffer, MAGIC_BYTES.webp.bytes) &&
    matchesBytes(buffer, MAGIC_BYTES.webp.check!, MAGIC_BYTES.webp.offset!)
  ) {
    return 'webp';
  }

  // Check AVIF (....ftyp then avif or avis brand)
  if (matchesBytes(buffer, MAGIC_BYTES.avif.check!, MAGIC_BYTES.avif.offset!)) {
    // AVIF uses ftyp box with 'avif' or 'avis' brand
    const brand = String.fromCharCode(...buffer.slice(8, 12));
    if (brand === 'avif' || brand === 'avis' || brand === 'mif1' || brand === 'miaf') {
      return 'avif';
    }
  }

  return null;
}

/**
 * Check if buffer starts with given bytes at offset
 */
function matchesBytes(buffer: Uint8Array, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buffer[offset + i] !== bytes[i]) return false;
  }
  return true;
}

/**
 * Get MIME type for image format
 */
export function getMimeType(format: ImageFormat): string {
  const mimeTypes: Record<ImageFormat, string> = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    avif: 'image/avif',
  };
  return mimeTypes[format];
}

/**
 * Get file extension for image format
 */
export function getExtension(format: ImageFormat): string {
  const extensions: Record<ImageFormat, string> = {
    png: 'png',
    jpeg: 'jpg',
    webp: 'webp',
    gif: 'gif',
    avif: 'avif',
  };
  return extensions[format];
}
