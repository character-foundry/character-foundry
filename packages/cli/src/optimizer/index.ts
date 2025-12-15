/**
 * Optimizer
 *
 * Main orchestration for package optimization.
 */

import { basename, dirname, extname, join } from 'node:path';
import { stat } from 'node:fs/promises';
import {
  extractPackage,
  repackPackage,
  cleanupTempDir,
  updateJsonReferences,
  type ExtractedPackage,
  type PathRemap,
} from './extractor.js';
import { checkFfmpeg, requireFfmpeg } from './ffmpeg.js';
import { optimizeImage, isSharpAvailable } from './image.js';
import { optimizeAudio } from './audio.js';
import { optimizeVideo } from './video.js';
import {
  type PresetName,
  type ImageOptions,
  type AudioOptions,
  type VideoOptions,
  getPreset,
  mergeOptions,
} from './presets.js';
import {
  type AssetResult,
  type OptimizationReport,
  printAssetSummary,
  printDryRunPreview,
  printProgress,
  printAssetResult,
  printFinalReport,
  printJsonReport,
  formatSize,
  calcSavings,
} from './reporter.js';

export interface OptimizeOptions {
  output?: string;
  preset: PresetName;
  dryRun: boolean;
  verbose: boolean;
  json: boolean;
  skipImages: boolean;
  skipAudio: boolean;
  skipVideo: boolean;
  // Image overrides
  imageFormat?: 'webp' | 'png' | 'jpeg';
  imageQuality?: number;
  imageMaxDimension?: number;
  imageMaxMegapixels?: number;
  // Audio overrides
  audioFormat?: 'mp3' | 'ogg' | 'aac' | 'flac';
  audioBitrate?: string;
  audioChannels?: number;
  audioSampleRate?: number;
  // Video overrides
  videoCodec?: 'libx264' | 'libx265' | 'libvpx-vp9';
  videoCrf?: number;
  videoMaxResolution?: '480p' | '720p' | '1080p' | '1440p' | '4k';
  videoFps?: number;
}

/**
 * Generate output path from input path
 */
function generateOutputPath(inputPath: string): string {
  const dir = dirname(inputPath);
  const ext = extname(inputPath);
  const name = basename(inputPath, ext);
  return join(dir, `${name}_optimized${ext}`);
}

/**
 * Main optimization function
 */
export async function optimize(
  inputPath: string,
  options: OptimizeOptions
): Promise<OptimizationReport> {
  const startTime = Date.now();
  const outputPath = options.output || generateOutputPath(inputPath);
  const errors: string[] = [];
  const assetResults: AssetResult[] = [];
  const pathRemaps: PathRemap[] = [];

  // Get preset and merge with overrides
  const preset = getPreset(options.preset);
  const { image: imageOptions, audio: audioOptions, video: videoOptions } = mergeOptions(
    preset,
    {
      imageFormat: options.imageFormat,
      imageQuality: options.imageQuality,
      imageMaxDimension: options.imageMaxDimension,
      imageMaxMegapixels: options.imageMaxMegapixels,
      audioFormat: options.audioFormat,
      audioBitrate: options.audioBitrate,
      audioChannels: options.audioChannels,
      audioSampleRate: options.audioSampleRate,
      videoCodec: options.videoCodec,
      videoCrf: options.videoCrf,
      videoMaxResolution: options.videoMaxResolution,
      videoFps: options.videoFps,
    }
  );

  // Check dependencies
  if (!options.json && !options.dryRun) {
    console.log('Checking dependencies...');
  }

  const ffmpegInfo = await checkFfmpeg();
  const hasSharp = await isSharpAvailable();

  if (!options.json && !options.dryRun) {
    const ffmpegStatus = ffmpegInfo.available
      ? `ffmpeg ${ffmpegInfo.version || ''} ✓`
      : 'ffmpeg NOT FOUND';
    const sharpStatus = hasSharp ? 'sharp ✓' : 'sharp (optional)';
    console.log(`  ${ffmpegStatus}`);
    console.log(`  ${sharpStatus}`);
  }

  // Require ffmpeg for audio/video
  if (!options.skipAudio || !options.skipVideo) {
    if (!ffmpegInfo.available) {
      await requireFfmpeg();
    }
  }

  // Extract package
  if (!options.json) {
    console.log('');
    console.log(`Extracting package: ${basename(inputPath)}`);
  }

  let extracted: ExtractedPackage;
  try {
    extracted = await extractPackage(inputPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Failed to extract package: ${msg}`);
    return {
      inputFile: inputPath,
      outputFile: outputPath,
      originalSize: 0,
      optimizedSize: 0,
      savings: 0,
      savingsPercent: 0,
      assets: [],
      duration: Date.now() - startTime,
      errors,
    };
  }

  if (!options.json) {
    console.log(`  Format: ${extracted.format}`);
    console.log(`  Size: ${formatSize(extracted.totalSize)}`);
  }

  // Print summary
  if (!options.json) {
    printAssetSummary(
      extracted,
      options.preset,
      options.skipImages,
      options.skipAudio,
      options.skipVideo
    );
  }

  // Dry run mode
  if (options.dryRun) {
    printDryRunPreview(inputPath, extracted, {
      preset: options.preset,
      image: imageOptions,
      audio: audioOptions,
      video: videoOptions,
      skipImages: options.skipImages,
      skipAudio: options.skipAudio,
      skipVideo: options.skipVideo,
    });

    await cleanupTempDir(extracted.tempDir);

    return {
      inputFile: inputPath,
      outputFile: outputPath,
      originalSize: extracted.totalSize,
      optimizedSize: extracted.totalSize,
      savings: 0,
      savingsPercent: 0,
      assets: [],
      duration: Date.now() - startTime,
      errors: [],
    };
  }

  // Process images
  const images = extracted.assets.filter((a) => a.type === 'image');
  if (images.length > 0 && !options.skipImages) {
    if (!options.json) {
      console.log('');
      console.log('Processing images...');
    }

    for (let i = 0; i < images.length; i++) {
      const asset = images[i]!;
      printProgress('image', i + 1, images.length, basename(asset.path), options.verbose);

      // Voxta thumbnail.png - convert to WebP only if savings are worth it (>100KB)
      const isVoxtaThumbnail =
        extracted.format === 'voxpkg' && basename(asset.path).toLowerCase() === 'thumbnail.png';

      // For small thumbnails (<100KB), keep as PNG - conversion overhead not worth it
      const keepAsPng = isVoxtaThumbnail && asset.size < 100 * 1024;

      const effectiveImageOptions: ImageOptions = keepAsPng
        ? { ...imageOptions, format: 'png' }
        : imageOptions;

      try {
        const result = await optimizeImage(asset.absolutePath, effectiveImageOptions);

        if (result.remap) {
          pathRemaps.push({
            oldPath: asset.path,
            newPath: asset.path.replace(
              new RegExp(`\\.${result.originalFormat}$`, 'i'),
              `.${result.optimizedFormat}`
            ),
          });
        }

        const assetResult: AssetResult = {
          path: asset.path,
          type: 'image',
          originalSize: result.originalSize,
          optimizedSize: result.optimizedSize,
          action: result.success
            ? result.optimizedSize < result.originalSize
              ? 'optimized'
              : 'skipped'
            : 'failed',
          details: result.success ? undefined : 'no improvement',
          error: result.error,
        };

        assetResults.push(assetResult);
        printAssetResult(assetResult, options.verbose);

        if (result.error) {
          errors.push(`Image ${asset.path}: ${result.error}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Image ${asset.path}: ${msg}`);
        assetResults.push({
          path: asset.path,
          type: 'image',
          originalSize: asset.size,
          optimizedSize: asset.size,
          action: 'failed',
          error: msg,
        });
      }
    }

    if (!options.verbose && !options.json) {
      console.log(''); // New line after progress
    }
  }

  // Process audio
  const audioFiles = extracted.assets.filter((a) => a.type === 'audio');
  if (audioFiles.length > 0 && !options.skipAudio) {
    if (!options.json) {
      console.log('');
      console.log('Processing audio...');
    }

    for (let i = 0; i < audioFiles.length; i++) {
      const asset = audioFiles[i]!;
      printProgress('audio', i + 1, audioFiles.length, basename(asset.path), options.verbose);

      try {
        const result = await optimizeAudio(asset.absolutePath, audioOptions);

        if (result.remap) {
          pathRemaps.push({
            oldPath: asset.path,
            newPath: asset.path.replace(
              new RegExp(`\\.${result.originalFormat}$`, 'i'),
              `.${result.optimizedFormat}`
            ),
          });
        }

        const assetResult: AssetResult = {
          path: asset.path,
          type: 'audio',
          originalSize: result.originalSize,
          optimizedSize: result.optimizedSize,
          action: result.success
            ? result.optimizedSize < result.originalSize
              ? 'optimized'
              : 'skipped'
            : 'failed',
          details: result.success ? undefined : 'no improvement',
          error: result.error,
        };

        assetResults.push(assetResult);
        printAssetResult(assetResult, options.verbose);

        if (result.error) {
          errors.push(`Audio ${asset.path}: ${result.error}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Audio ${asset.path}: ${msg}`);
        assetResults.push({
          path: asset.path,
          type: 'audio',
          originalSize: asset.size,
          optimizedSize: asset.size,
          action: 'failed',
          error: msg,
        });
      }
    }

    if (!options.verbose && !options.json) {
      console.log('');
    }
  }

  // Process video
  const videoFiles = extracted.assets.filter((a) => a.type === 'video');
  if (videoFiles.length > 0 && !options.skipVideo) {
    if (!options.json) {
      console.log('');
      console.log('Processing video...');
    }

    for (let i = 0; i < videoFiles.length; i++) {
      const asset = videoFiles[i]!;
      printProgress('video', i + 1, videoFiles.length, basename(asset.path), options.verbose);

      try {
        const result = await optimizeVideo(asset.absolutePath, videoOptions);

        if (result.remap) {
          pathRemaps.push({
            oldPath: asset.path,
            newPath: asset.path.replace(
              new RegExp(`\\.${result.originalFormat}$`, 'i'),
              `.${result.optimizedFormat}`
            ),
          });
        }

        const assetResult: AssetResult = {
          path: asset.path,
          type: 'video',
          originalSize: result.originalSize,
          optimizedSize: result.optimizedSize,
          action: result.success
            ? result.optimizedSize < result.originalSize * 0.95
              ? 'optimized'
              : 'skipped'
            : 'failed',
          details: result.success ? undefined : 'no improvement',
          error: result.error,
        };

        assetResults.push(assetResult);
        printAssetResult(assetResult, options.verbose);

        if (result.error) {
          errors.push(`Video ${asset.path}: ${result.error}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Video ${asset.path}: ${msg}`);
        assetResults.push({
          path: asset.path,
          type: 'video',
          originalSize: asset.size,
          optimizedSize: asset.size,
          action: 'failed',
          error: msg,
        });
      }
    }

    if (!options.verbose && !options.json) {
      console.log('');
    }
  }

  // Update JSON references if any paths changed
  if (pathRemaps.length > 0) {
    if (!options.json) {
      console.log('');
      console.log('Updating asset references in metadata...');
    }
    await updateJsonReferences(extracted.tempDir, extracted.metaFiles, pathRemaps);
  }

  // Repack
  if (!options.json) {
    console.log('');
    console.log('Repacking...');
  }

  let optimizedSize: number;
  try {
    optimizedSize = await repackPackage(extracted, outputPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Failed to repack: ${msg}`);
    optimizedSize = extracted.totalSize;
  }

  // Clean up
  await cleanupTempDir(extracted.tempDir);

  // Build report
  const report: OptimizationReport = {
    inputFile: inputPath,
    outputFile: outputPath,
    originalSize: extracted.totalSize,
    optimizedSize,
    savings: extracted.totalSize - optimizedSize,
    savingsPercent: calcSavings(extracted.totalSize, optimizedSize),
    assets: assetResults,
    duration: Date.now() - startTime,
    errors,
  };

  // Print report
  if (options.json) {
    printJsonReport(report);
  } else {
    printFinalReport(report, options.verbose);
  }

  return report;
}

// Re-export types
export type { AssetResult, OptimizationReport } from './reporter.js';
export type { PresetName, ImageOptions, AudioOptions, VideoOptions } from './presets.js';
export { PRESETS, getPreset } from './presets.js';
