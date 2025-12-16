/**
 * Image Optimizer
 *
 * Compress and resize images using sharp (preferred) or ffmpeg (fallback).
 */

import { stat, unlink, rename } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import type { ImageOptions } from './presets.js';
import { runFfmpegCommand } from './ffmpeg.js';
import type { PathRemap } from './extractor.js';

export interface ImageOptimizeResult {
  success: boolean;
  originalSize: number;
  optimizedSize: number;
  originalDimensions?: { width: number; height: number };
  optimizedDimensions?: { width: number; height: number };
  originalFormat: string;
  optimizedFormat: string;
  remap?: PathRemap;
  error?: string;
}

// Sharp function type - the callable function that creates a Sharp instance
type SharpFn = (input?: string | Buffer | Uint8Array, options?: object) => {
  metadata(): Promise<{ width?: number; height?: number; format?: string }>;
  resize(width?: number, height?: number, options?: object): ReturnType<SharpFn>;
  webp(options?: { quality?: number }): ReturnType<SharpFn>;
  jpeg(options?: { quality?: number }): ReturnType<SharpFn>;
  png(options?: { compressionLevel?: number }): ReturnType<SharpFn>;
  toFile(path: string): Promise<{ size: number }>;
};

// Try to load sharp dynamically (optional dependency)
let sharpFn: SharpFn | null | undefined = undefined;

async function getSharp(): Promise<SharpFn | null> {
  if (sharpFn !== undefined) return sharpFn;

  try {
    const mod = await import('sharp');
    // Handle both ESM default export and CJS
    sharpFn = (mod.default || mod) as unknown as SharpFn;
    return sharpFn;
  } catch {
    sharpFn = null;
    return null;
  }
}

/**
 * Check if sharp is available
 */
export async function isSharpAvailable(): Promise<boolean> {
  const sharp = await getSharp();
  return sharp !== null;
}

/**
 * Get image dimensions using sharp or ffprobe
 */
export async function getImageDimensions(
  filePath: string
): Promise<{ width: number; height: number } | null> {
  // Try sharp first
  const sharp = await getSharp();
  if (sharp) {
    try {
      const metadata = await sharp(filePath).metadata();
      if (metadata.width && metadata.height) {
        return { width: metadata.width, height: metadata.height };
      }
    } catch {
      // Fall through to ffprobe
    }
  }

  // Try ffprobe
  try {
    const result = await runFfmpegCommand([
      '-hide_banner',
      '-i', filePath,
    ]);
    // Parse dimensions from stderr (ffmpeg outputs to stderr)
    const match = result.stderr.match(/(\d+)x(\d+)/);
    if (match) {
      return { width: parseInt(match[1]!, 10), height: parseInt(match[2]!, 10) };
    }
  } catch {
    // Unable to get dimensions
  }

  return null;
}

/**
 * Calculate new dimensions to fit within max size while preserving aspect ratio
 */
function calculateResizedDimensions(
  width: number,
  height: number,
  maxDimension?: number,
  maxMegapixels?: number
): { width: number; height: number } | null {
  let targetWidth = width;
  let targetHeight = height;
  let needsResize = false;

  // Check max dimension
  if (maxDimension && (width > maxDimension || height > maxDimension)) {
    const scale = maxDimension / Math.max(width, height);
    targetWidth = Math.round(width * scale);
    targetHeight = Math.round(height * scale);
    needsResize = true;
  }

  // Check max megapixels
  if (maxMegapixels) {
    const currentMp = (targetWidth * targetHeight) / 1_000_000;
    if (currentMp > maxMegapixels) {
      const scale = Math.sqrt(maxMegapixels / currentMp);
      targetWidth = Math.round(targetWidth * scale);
      targetHeight = Math.round(targetHeight * scale);
      needsResize = true;
    }
  }

  // Ensure dimensions are even (required for some codecs)
  targetWidth = Math.round(targetWidth / 2) * 2;
  targetHeight = Math.round(targetHeight / 2) * 2;

  return needsResize ? { width: targetWidth, height: targetHeight } : null;
}

/**
 * Optimize an image file
 */
export async function optimizeImage(
  inputPath: string,
  options: ImageOptions
): Promise<ImageOptimizeResult> {
  const originalStats = await stat(inputPath);
  const originalSize = originalStats.size;
  const originalFormat = extname(inputPath).slice(1).toLowerCase();
  const dimensions = await getImageDimensions(inputPath);

  // Check if we need to change format
  const newFormat = options.format;
  const formatChanged = originalFormat !== newFormat;

  // Calculate output path
  const dir = dirname(inputPath);
  const name = basename(inputPath, extname(inputPath));
  const outputPath = join(dir, `${name}.${newFormat}`);
  const tempPath = join(dir, `${name}_optimizing.${newFormat}`);

  // Calculate target dimensions
  const newDimensions = dimensions
    ? calculateResizedDimensions(
        dimensions.width,
        dimensions.height,
        options.maxDimension,
        options.maxMegapixels
      )
    : null;

  // Try sharp first
  const sharp = await getSharp();
  if (sharp) {
    try {
      let pipeline = sharp(inputPath);

      // Resize if needed
      if (newDimensions) {
        pipeline = pipeline.resize(newDimensions.width, newDimensions.height, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      // Convert/compress based on format
      switch (newFormat) {
        case 'webp':
          pipeline = pipeline.webp({ quality: options.quality });
          break;
        case 'jpeg':
          pipeline = pipeline.jpeg({ quality: options.quality });
          break;
        case 'png':
          pipeline = pipeline.png({
            compressionLevel: Math.round((100 - options.quality) / 10),
          });
          break;
      }

      await pipeline.toFile(tempPath);

      // Check if optimization was beneficial
      const newStats = await stat(tempPath);
      const optimizedSize = newStats.size;

      // If format changed or size reduced, use optimized version
      if (formatChanged || optimizedSize < originalSize) {
        // Remove original if format changed
        if (formatChanged) {
          await unlink(inputPath);
        }
        await rename(tempPath, outputPath);

        return {
          success: true,
          originalSize,
          optimizedSize,
          originalDimensions: dimensions ?? undefined,
          optimizedDimensions: newDimensions ?? dimensions ?? undefined,
          originalFormat,
          optimizedFormat: newFormat,
          remap: formatChanged
            ? { oldPath: inputPath, newPath: outputPath }
            : undefined,
        };
      } else {
        // Keep original
        await unlink(tempPath);
        return {
          success: true,
          originalSize,
          optimizedSize: originalSize,
          originalDimensions: dimensions ?? undefined,
          optimizedDimensions: dimensions ?? undefined,
          originalFormat,
          optimizedFormat: originalFormat,
        };
      }
    } catch {
      // Clean up temp file if it exists
      try {
        await unlink(tempPath);
      } catch {
        // Ignore
      }
      // Fall through to ffmpeg
    }
  }

  // Fallback to ffmpeg
  try {
    const ffmpegArgs = ['-y', '-i', inputPath];

    // Add resize filter if needed
    if (newDimensions) {
      ffmpegArgs.push('-vf', `scale=${newDimensions.width}:${newDimensions.height}`);
    }

    // Add quality settings
    switch (newFormat) {
      case 'webp':
        ffmpegArgs.push('-quality', String(options.quality));
        break;
      case 'jpeg':
        ffmpegArgs.push('-q:v', String(Math.round((100 - options.quality) * 0.31)));
        break;
      case 'png':
        // PNG compression via ffmpeg is limited
        break;
    }

    ffmpegArgs.push(tempPath);

    const result = await runFfmpegCommand(ffmpegArgs);

    if (result.success) {
      const newStats = await stat(tempPath);
      const optimizedSize = newStats.size;

      if (formatChanged || optimizedSize < originalSize) {
        if (formatChanged) {
          await unlink(inputPath);
        }
        await rename(tempPath, outputPath);

        return {
          success: true,
          originalSize,
          optimizedSize,
          originalDimensions: dimensions ?? undefined,
          optimizedDimensions: newDimensions ?? dimensions ?? undefined,
          originalFormat,
          optimizedFormat: newFormat,
          remap: formatChanged
            ? { oldPath: inputPath, newPath: outputPath }
            : undefined,
        };
      } else {
        await unlink(tempPath);
        return {
          success: true,
          originalSize,
          optimizedSize: originalSize,
          originalDimensions: dimensions ?? undefined,
          optimizedDimensions: dimensions ?? undefined,
          originalFormat,
          optimizedFormat: originalFormat,
        };
      }
    }

    return {
      success: false,
      originalSize,
      optimizedSize: originalSize,
      originalFormat,
      optimizedFormat: originalFormat,
      error: result.stderr || 'ffmpeg failed',
    };
  } catch (err) {
    return {
      success: false,
      originalSize,
      optimizedSize: originalSize,
      originalFormat,
      optimizedFormat: originalFormat,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
