/**
 * Audio Optimizer
 *
 * Re-encode audio files using ffmpeg.
 */

import { stat, unlink, rename } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import type { AudioOptions } from './presets.js';
import { runFfmpegCommand, getMediaDuration } from './ffmpeg.js';
import type { PathRemap } from './extractor.js';

export interface AudioOptimizeResult {
  success: boolean;
  originalSize: number;
  optimizedSize: number;
  originalFormat: string;
  optimizedFormat: string;
  duration?: number;
  remap?: PathRemap;
  error?: string;
}

/**
 * Get the ffmpeg audio codec for a format
 */
function getAudioCodec(format: AudioOptions['format']): string {
  switch (format) {
    case 'mp3':
      return 'libmp3lame';
    case 'ogg':
      return 'libvorbis';
    case 'aac':
      return 'aac';
    case 'flac':
      return 'flac';
    default:
      return 'copy';
  }
}

/**
 * Get file extension for audio format
 */
function getAudioExtension(format: AudioOptions['format']): string {
  switch (format) {
    case 'mp3':
      return 'mp3';
    case 'ogg':
      return 'ogg';
    case 'aac':
      return 'm4a'; // AAC in M4A container is more compatible
    case 'flac':
      return 'flac';
    default:
      return format;
  }
}

/**
 * Check if audio format is lossless
 */
function isLosslessFormat(format: string): boolean {
  return ['wav', 'flac', 'aiff', 'alac'].includes(format.toLowerCase());
}

/**
 * Optimize an audio file
 */
export async function optimizeAudio(
  inputPath: string,
  options: AudioOptions
): Promise<AudioOptimizeResult> {
  const originalStats = await stat(inputPath);
  const originalSize = originalStats.size;
  const originalFormat = extname(inputPath).slice(1).toLowerCase();
  const duration = await getMediaDuration(inputPath);

  // Determine output format
  const newFormat = options.format;
  const newExt = getAudioExtension(newFormat);
  const formatChanged = originalFormat !== newExt;

  // Skip if converting lossy to lossless (pointless)
  if (newFormat === 'flac' && !isLosslessFormat(originalFormat)) {
    return {
      success: true,
      originalSize,
      optimizedSize: originalSize,
      originalFormat,
      optimizedFormat: originalFormat,
      duration: duration ?? undefined,
      // Don't convert lossy to lossless
    };
  }

  // Calculate output path
  const dir = dirname(inputPath);
  const name = basename(inputPath, extname(inputPath));
  const outputPath = join(dir, `${name}.${newExt}`);
  const tempPath = join(dir, `${name}_optimizing.${newExt}`);

  // Build ffmpeg command
  const ffmpegArgs = [
    '-y',
    '-i', inputPath,
    '-vn', // No video
  ];

  // Add codec
  const codec = getAudioCodec(newFormat);
  ffmpegArgs.push('-c:a', codec);

  // Add bitrate (except for lossless)
  if (newFormat !== 'flac' && options.bitrate && options.bitrate !== '0') {
    ffmpegArgs.push('-b:a', options.bitrate);
  }

  // Add channel configuration
  if (options.channels) {
    ffmpegArgs.push('-ac', String(options.channels));
  }

  // Add sample rate
  if (options.sampleRate) {
    ffmpegArgs.push('-ar', String(options.sampleRate));
  }

  // Add output
  ffmpegArgs.push(tempPath);

  try {
    const result = await runFfmpegCommand(ffmpegArgs);

    if (result.success) {
      const newStats = await stat(tempPath);
      const optimizedSize = newStats.size;

      // Use optimized if format changed or size reduced
      if (formatChanged || optimizedSize < originalSize) {
        // Remove original if format changed
        if (formatChanged) {
          await unlink(inputPath);
        }
        await rename(tempPath, outputPath);

        // Calculate path relative to package root for remap
        const inputRelPath = inputPath;
        const outputRelPath = outputPath;

        return {
          success: true,
          originalSize,
          optimizedSize,
          originalFormat,
          optimizedFormat: newExt,
          duration: duration ?? undefined,
          remap: formatChanged
            ? { oldPath: inputRelPath, newPath: outputRelPath }
            : undefined,
        };
      } else {
        // Keep original
        await unlink(tempPath);
        return {
          success: true,
          originalSize,
          optimizedSize: originalSize,
          originalFormat,
          optimizedFormat: originalFormat,
          duration: duration ?? undefined,
        };
      }
    }

    // Clean up temp file on failure
    try {
      await unlink(tempPath);
    } catch {
      // Ignore
    }

    return {
      success: false,
      originalSize,
      optimizedSize: originalSize,
      originalFormat,
      optimizedFormat: originalFormat,
      duration: duration ?? undefined,
      error: result.stderr || 'ffmpeg failed',
    };
  } catch (err) {
    // Clean up temp file on error
    try {
      await unlink(tempPath);
    } catch {
      // Ignore
    }

    return {
      success: false,
      originalSize,
      optimizedSize: originalSize,
      originalFormat,
      optimizedFormat: originalFormat,
      duration: duration ?? undefined,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
