/**
 * Thumbnail Generation
 *
 * Create thumbnails from image data.
 * Works in both Node.js (sharp) and browser (canvas) environments.
 */

import { detectImageFormat, getMimeType, type ImageFormat } from './format.js';
import { getImageDimensions } from './dimensions.js';

/**
 * Thumbnail generation options
 */
export interface ThumbnailOptions {
  /** Maximum dimension (width or height). Default: 400 */
  maxSize?: number;
  /** Output format. Default: 'webp' */
  format?: 'webp' | 'jpeg' | 'png';
  /** Quality (0-1). Default: 0.8 */
  quality?: number;
  /** Fallback format if primary unsupported. Default: 'jpeg' */
  fallbackFormat?: 'jpeg' | 'png';
  /** Timeout in ms. Default: 10000 */
  timeout?: number;
}

const DEFAULT_OPTIONS: Required<ThumbnailOptions> = {
  maxSize: 400,
  format: 'webp',
  quality: 0.8,
  fallbackFormat: 'jpeg',
  timeout: 10000,
};

/**
 * Check if we're in Node.js environment
 */
const isNode = typeof window === 'undefined' && typeof process !== 'undefined';

/**
 * Create a thumbnail from image data.
 *
 * Works in both Node.js (sharp) and browser (canvas) environments.
 *
 * @param imageData - Source image data
 * @param options - Thumbnail options
 * @returns Thumbnail image data
 */
export async function createThumbnail(
  imageData: Uint8Array,
  options: ThumbnailOptions = {}
): Promise<Uint8Array> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Verify input is a valid image
  const format = detectImageFormat(imageData);
  if (!format) {
    throw new Error('Input is not a recognized image format');
  }

  // Get dimensions to check if resize is needed
  const dims = getImageDimensions(imageData);
  if (!dims) {
    throw new Error('Could not determine image dimensions');
  }

  // Check if resize is needed
  const needsResize = dims.width > opts.maxSize || dims.height > opts.maxSize;

  if (isNode) {
    return createThumbnailNode(imageData, opts, needsResize);
  } else {
    return createThumbnailBrowser(imageData, opts, needsResize, format);
  }
}

/**
 * Create thumbnail using sharp (Node.js)
 */
async function createThumbnailNode(
  imageData: Uint8Array,
  options: Required<ThumbnailOptions>,
  needsResize: boolean
): Promise<Uint8Array> {
  // Dynamically import sharp
  let sharp: typeof import('sharp');
  try {
    sharp = (await import('sharp')).default;
  } catch {
    throw new Error(
      'sharp is required for thumbnail generation in Node.js. Install with: npm install sharp'
    );
  }

  let pipeline = sharp(Buffer.from(imageData));

  if (needsResize) {
    pipeline = pipeline.resize(options.maxSize, options.maxSize, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Apply format conversion
  const quality = Math.round(options.quality * 100);

  switch (options.format) {
    case 'webp':
      pipeline = pipeline.webp({ quality });
      break;
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality });
      break;
    case 'png':
      pipeline = pipeline.png({ compressionLevel: 9 });
      break;
  }

  const result = await pipeline.toBuffer();
  return new Uint8Array(result);
}

/**
 * Create thumbnail using Canvas API (Browser)
 */
async function createThumbnailBrowser(
  imageData: Uint8Array,
  options: Required<ThumbnailOptions>,
  needsResize: boolean,
  inputFormat: ImageFormat
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Thumbnail generation timed out after ${options.timeout}ms`));
    }, options.timeout);

    try {
      // Create blob from image data
      const mimeType = getMimeType(inputFormat);
      // Need to slice to handle potential SharedArrayBuffer
      const blob = new Blob([new Uint8Array(imageData)], { type: mimeType });
      const url = URL.createObjectURL(blob);

      const img = new Image();

      img.onload = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(url);

        try {
          // Calculate target dimensions
          let targetWidth = img.width;
          let targetHeight = img.height;

          if (needsResize) {
            const scale = Math.min(
              options.maxSize / img.width,
              options.maxSize / img.height
            );
            targetWidth = Math.round(img.width * scale);
            targetHeight = Math.round(img.height * scale);
          }

          // Create canvas and draw
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          // Try to export in requested format
          let outputMimeType = `image/${options.format}`;
          let dataUrl = canvas.toDataURL(outputMimeType, options.quality);

          // Check if format was supported (canvas falls back to PNG if unsupported)
          if (!dataUrl.startsWith(`data:${outputMimeType}`) && options.format === 'webp') {
            // WebP not supported, use fallback
            outputMimeType = `image/${options.fallbackFormat}`;
            dataUrl = canvas.toDataURL(outputMimeType, options.quality);
          }

          // Convert data URL to Uint8Array
          const base64 = dataUrl.split(',')[1]!;
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }

          resolve(bytes);
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    } catch (err) {
      clearTimeout(timeoutId);
      reject(err);
    }
  });
}

/**
 * Calculate target dimensions while preserving aspect ratio
 */
export function calculateThumbnailDimensions(
  width: number,
  height: number,
  maxSize: number
): { width: number; height: number } {
  if (width <= maxSize && height <= maxSize) {
    return { width, height };
  }

  const scale = Math.min(maxSize / width, maxSize / height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}
