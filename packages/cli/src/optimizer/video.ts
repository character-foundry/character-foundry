/**
 * Video Optimizer
 *
 * Re-encode video files using ffmpeg.
 */

import { stat, unlink, rename } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import type { VideoOptions, VideoResolution } from './presets.js';
import { RESOLUTION_MAP } from './presets.js';
import { runFfmpegCommand, getMediaDuration, getVideoResolution } from './ffmpeg.js';
import type { PathRemap } from './extractor.js';

export interface VideoOptimizeResult {
  success: boolean;
  originalSize: number;
  optimizedSize: number;
  originalFormat: string;
  optimizedFormat: string;
  originalResolution?: { width: number; height: number };
  optimizedResolution?: { width: number; height: number };
  duration?: number;
  remap?: PathRemap;
  error?: string;
}

/**
 * Get the container format for a video codec
 */
function getVideoContainer(codec: VideoOptions['codec']): string {
  switch (codec) {
    case 'libx264':
    case 'libx265':
      return 'mp4';
    case 'libvpx-vp9':
      return 'webm';
    default:
      return 'mp4';
  }
}

/**
 * Build ffmpeg video filter for scaling
 */
function buildScaleFilter(
  width: number,
  height: number,
  maxResolution: VideoResolution,
  maxFps?: number
): string {
  const maxHeight = RESOLUTION_MAP[maxResolution];
  const filters: string[] = [];

  // Calculate if we need to scale down
  if (height > maxHeight) {
    // Scale to max height, maintaining aspect ratio
    // Use -2 to ensure width is divisible by 2
    filters.push(`scale=-2:${maxHeight}`);
  } else if (width % 2 !== 0 || height % 2 !== 0) {
    // Ensure dimensions are even (required for most codecs)
    filters.push('scale=trunc(iw/2)*2:trunc(ih/2)*2');
  }

  // Add FPS filter if needed
  if (maxFps) {
    filters.push(`fps=${maxFps}`);
  }

  return filters.join(',');
}

/**
 * Optimize a video file
 */
export async function optimizeVideo(
  inputPath: string,
  options: VideoOptions
): Promise<VideoOptimizeResult> {
  const originalStats = await stat(inputPath);
  const originalSize = originalStats.size;
  const originalFormat = extname(inputPath).slice(1).toLowerCase();
  const duration = await getMediaDuration(inputPath);
  const resolution = await getVideoResolution(inputPath);

  // Determine output format
  const newContainer = getVideoContainer(options.codec);
  const formatChanged = originalFormat !== newContainer;

  // Calculate output path
  const dir = dirname(inputPath);
  const name = basename(inputPath, extname(inputPath));
  const outputPath = join(dir, `${name}.${newContainer}`);
  const tempPath = join(dir, `${name}_optimizing.${newContainer}`);

  // Build ffmpeg command
  const ffmpegArgs = [
    '-y',
    '-i', inputPath,
  ];

  // Add video codec
  ffmpegArgs.push('-c:v', options.codec);

  // Add CRF (quality)
  ffmpegArgs.push('-crf', String(options.crf));

  // Add video filters (scaling, fps)
  if (resolution) {
    const vf = buildScaleFilter(
      resolution.width,
      resolution.height,
      options.maxResolution,
      options.maxFps
    );
    if (vf) {
      ffmpegArgs.push('-vf', vf);
    }
  }

  // Add codec-specific options
  switch (options.codec) {
    case 'libx264':
      ffmpegArgs.push('-preset', 'medium');
      ffmpegArgs.push('-profile:v', 'high');
      ffmpegArgs.push('-level', '4.1');
      break;
    case 'libx265':
      ffmpegArgs.push('-preset', 'medium');
      ffmpegArgs.push('-tag:v', 'hvc1'); // For Apple compatibility
      break;
    case 'libvpx-vp9':
      ffmpegArgs.push('-b:v', '0'); // Use CRF mode
      ffmpegArgs.push('-deadline', 'good');
      ffmpegArgs.push('-cpu-used', '2');
      break;
  }

  // Add audio settings
  ffmpegArgs.push('-c:a', 'aac');
  ffmpegArgs.push('-b:a', options.audioBitrate);

  // Add output
  ffmpegArgs.push(tempPath);

  try {
    const result = await runFfmpegCommand(ffmpegArgs);

    if (result.success) {
      const newStats = await stat(tempPath);
      const optimizedSize = newStats.size;

      // Get new resolution
      const newResolution = await getVideoResolution(tempPath);

      // Use optimized if format changed or size significantly reduced
      // For video, we're more aggressive since re-encoding usually helps
      if (optimizedSize < originalSize * 0.95 || formatChanged) {
        // Remove original if format changed
        if (formatChanged) {
          await unlink(inputPath);
        }
        await rename(tempPath, outputPath);

        return {
          success: true,
          originalSize,
          optimizedSize,
          originalFormat,
          optimizedFormat: newContainer,
          originalResolution: resolution ?? undefined,
          optimizedResolution: newResolution ?? resolution ?? undefined,
          duration: duration ?? undefined,
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
          originalFormat,
          optimizedFormat: originalFormat,
          originalResolution: resolution ?? undefined,
          optimizedResolution: resolution ?? undefined,
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
      originalResolution: resolution ?? undefined,
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
      originalResolution: resolution ?? undefined,
      duration: duration ?? undefined,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
