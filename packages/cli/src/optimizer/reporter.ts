/**
 * Reporter
 *
 * Progress and results reporting for optimization.
 */

import { basename } from 'node:path';
import type { ExtractedPackage } from './extractor.js';
import type { PresetName, ImageOptions, AudioOptions, VideoOptions } from './presets.js';

export interface AssetResult {
  path: string;
  type: 'image' | 'audio' | 'video';
  originalSize: number;
  optimizedSize: number;
  action: 'optimized' | 'skipped' | 'failed';
  details?: string;
  error?: string;
}

export interface OptimizationReport {
  inputFile: string;
  outputFile: string;
  originalSize: number;
  optimizedSize: number;
  savings: number;
  savingsPercent: number;
  assets: AssetResult[];
  duration: number; // Processing time in ms
  errors: string[];
}

/**
 * Format bytes to human-readable size
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format duration in ms to human-readable
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Calculate savings percentage
 */
export function calcSavings(original: number, optimized: number): number {
  if (original === 0) return 0;
  return ((original - optimized) / original) * 100;
}

/**
 * Print asset summary for dry run
 */
export function printAssetSummary(
  extracted: ExtractedPackage,
  preset: PresetName,
  skipImages: boolean,
  skipAudio: boolean,
  skipVideo: boolean
): void {
  const images = extracted.assets.filter((a) => a.type === 'image');
  const audio = extracted.assets.filter((a) => a.type === 'audio');
  const video = extracted.assets.filter((a) => a.type === 'video');
  const other = extracted.assets.filter((a) => a.type === 'other');

  console.log('');
  console.log(`Found ${extracted.assets.length} assets:`);

  if (images.length > 0) {
    const totalSize = images.reduce((sum, a) => sum + a.size, 0);
    const status = skipImages ? ' (skipped)' : '';
    console.log(`  Images: ${images.length} (${formatSize(totalSize)})${status}`);
  }

  if (audio.length > 0) {
    const totalSize = audio.reduce((sum, a) => sum + a.size, 0);
    const status = skipAudio ? ' (skipped)' : '';
    console.log(`  Audio:  ${audio.length} (${formatSize(totalSize)})${status}`);
  }

  if (video.length > 0) {
    const totalSize = video.reduce((sum, a) => sum + a.size, 0);
    const status = skipVideo ? ' (skipped)' : '';
    console.log(`  Video:  ${video.length} (${formatSize(totalSize)})${status}`);
  }

  if (other.length > 0) {
    const totalSize = other.reduce((sum, a) => sum + a.size, 0);
    console.log(`  Other:  ${other.length} (${formatSize(totalSize)}) (skipped)`);
  }
}

/**
 * Print dry run preview
 */
export function printDryRunPreview(
  inputPath: string,
  extracted: ExtractedPackage,
  options: {
    preset: PresetName;
    image: ImageOptions;
    audio: AudioOptions;
    video: VideoOptions;
    skipImages: boolean;
    skipAudio: boolean;
    skipVideo: boolean;
  }
): void {
  console.log('');
  console.log('Dry Run - No changes will be made');
  console.log('');
  console.log(`Package: ${basename(inputPath)} (${formatSize(extracted.totalSize)})`);
  console.log(`Preset: ${options.preset}`);

  printAssetSummary(
    extracted,
    options.preset,
    options.skipImages,
    options.skipAudio,
    options.skipVideo
  );

  console.log('');
  console.log('Planned operations:');
  console.log('');

  // Images
  const images = extracted.assets.filter((a) => a.type === 'image');
  if (images.length > 0 && !options.skipImages) {
    console.log(`Images (${images.length} files):`);
    for (const img of images.slice(0, 5)) {
      const details = `→ ${options.image.format.toUpperCase()} ${options.image.quality}%`;
      const resize = options.image.maxDimension
        ? ` max ${options.image.maxDimension}px`
        : '';
      console.log(`  ${basename(img.path).padEnd(30)} ${formatSize(img.size).padEnd(10)} ${details}${resize}`);
    }
    if (images.length > 5) {
      console.log(`  ... and ${images.length - 5} more`);
    }
    console.log('');
  }

  // Audio
  const audio = extracted.assets.filter((a) => a.type === 'audio');
  if (audio.length > 0 && !options.skipAudio) {
    console.log(`Audio (${audio.length} files):`);
    for (const aud of audio.slice(0, 5)) {
      const details = `→ ${options.audio.format.toUpperCase()} ${options.audio.bitrate}`;
      console.log(`  ${basename(aud.path).padEnd(30)} ${formatSize(aud.size).padEnd(10)} ${details}`);
    }
    if (audio.length > 5) {
      console.log(`  ... and ${audio.length - 5} more`);
    }
    console.log('');
  }

  // Video
  const video = extracted.assets.filter((a) => a.type === 'video');
  if (video.length > 0 && !options.skipVideo) {
    console.log(`Video (${video.length} files):`);
    for (const vid of video.slice(0, 5)) {
      const codec = options.video.codec.replace('lib', '').toUpperCase();
      const details = `→ ${codec} CRF ${options.video.crf} max ${options.video.maxResolution}`;
      console.log(`  ${basename(vid.path).padEnd(30)} ${formatSize(vid.size).padEnd(10)} ${details}`);
    }
    if (video.length > 5) {
      console.log(`  ... and ${video.length - 5} more`);
    }
    console.log('');
  }

  console.log('Run without --dry-run to apply changes.');
}

/**
 * Print progress for an asset being processed
 */
export function printProgress(
  type: string,
  current: number,
  total: number,
  filename: string,
  verbose: boolean
): void {
  if (verbose) {
    console.log(`[${current}/${total}] Processing ${type}: ${filename}`);
  } else {
    // Simple progress indicator
    process.stdout.write(`\rProcessing ${type}... [${current}/${total}]`);
  }
}

/**
 * Print result for a single asset
 */
export function printAssetResult(
  result: AssetResult,
  verbose: boolean
): void {
  if (!verbose) return;

  const filename = basename(result.path);
  const savings = calcSavings(result.originalSize, result.optimizedSize);

  if (result.action === 'optimized') {
    console.log(
      `  ${filename}: ${formatSize(result.originalSize)} → ${formatSize(result.optimizedSize)} (-${formatPercent(savings)})`
    );
  } else if (result.action === 'skipped') {
    console.log(`  ${filename}: skipped (${result.details || 'no improvement'})`);
  } else if (result.action === 'failed') {
    console.log(`  ${filename}: FAILED - ${result.error}`);
  }
}

/**
 * Print final optimization report
 */
export function printFinalReport(report: OptimizationReport, _verbose: boolean): void {
  console.log('');
  console.log('Results:');
  console.log(`  Original:  ${formatSize(report.originalSize)}`);
  console.log(`  Optimized: ${formatSize(report.optimizedSize)}`);
  console.log(`  Saved:     ${formatSize(report.savings)} (${formatPercent(report.savingsPercent)})`);
  console.log(`  Time:      ${formatDuration(report.duration)}`);
  console.log('');

  if (report.errors.length > 0) {
    console.log('Errors:');
    for (const error of report.errors) {
      console.log(`  - ${error}`);
    }
    console.log('');
  }

  console.log(`Output saved to: ${report.outputFile}`);
}

/**
 * Print JSON report
 */
export function printJsonReport(report: OptimizationReport): void {
  console.log(JSON.stringify({
    success: report.errors.length === 0,
    inputFile: report.inputFile,
    outputFile: report.outputFile,
    originalSize: report.originalSize,
    optimizedSize: report.optimizedSize,
    savings: report.savings,
    savingsPercent: report.savingsPercent,
    duration: report.duration,
    assets: report.assets.map((a) => ({
      path: a.path,
      type: a.type,
      originalSize: a.originalSize,
      optimizedSize: a.optimizedSize,
      action: a.action,
      ...(a.error && { error: a.error }),
    })),
    errors: report.errors,
  }, null, 2));
}
