/**
 * Optimize Command
 *
 * Optimize assets in character card packages (voxpkg, charx).
 */

import { Command } from 'commander';
import { access } from 'node:fs/promises';
import { optimize } from '../optimizer/index.js';
import { PRESETS } from '../optimizer/presets.js';

export function createOptimizeCommand(): Command {
  const cmd = new Command('optimize')
    .description(
      'Optimize assets in character card packages (voxpkg, charx).\n' +
      'Compresses images, re-encodes audio/video to reduce file size.\n' +
      'Original file is never modified - output goes to a new file.'
    )
    .argument('<input>', 'Input package file (.voxpkg, .charx)')

    // General options
    .option('-o, --output <path>', 'Output file path (default: <input>_optimized.<ext>)')
    .option(
      '-p, --preset <name>',
      'Optimization preset: balanced, web, mobile, archive',
      'balanced'
    )
    .option('-n, --dry-run', 'Preview changes without modifying anything', false)
    .option('-v, --verbose', 'Show detailed progress for each asset', false)
    .option('--json', 'Output results as JSON', false)

    // Skip options
    .option('--skip-images', "Don't optimize images", false)
    .option('--skip-audio', "Don't optimize audio", false)
    .option('--skip-video', "Don't optimize video", false)

    // Image options
    .option(
      '--image-format <format>',
      'Output format: webp, png, jpeg'
    )
    .option(
      '--image-quality <1-100>',
      'Compression quality (default: varies by preset)',
      parseInt
    )
    .option(
      '--image-max-dimension <px>',
      'Maximum width/height in pixels',
      parseInt
    )
    .option(
      '--image-max-megapixels <mp>',
      'Maximum megapixels',
      parseFloat
    )

    // Audio options
    .option(
      '--audio-format <format>',
      'Output format: mp3, ogg, aac, flac'
    )
    .option(
      '--audio-bitrate <rate>',
      'Bitrate: 64k, 128k, 192k, 320k'
    )
    .option(
      '--audio-channels <n>',
      'Number of channels: 1 (mono), 2 (stereo)',
      parseInt
    )
    .option(
      '--audio-sample-rate <hz>',
      'Sample rate: 22050, 44100, 48000',
      parseInt
    )

    // Video options
    .option(
      '--video-codec <codec>',
      'Video codec: libx264, libx265, libvpx-vp9'
    )
    .option(
      '--video-crf <0-51>',
      'Quality (lower = better, default: varies by preset)',
      parseInt
    )
    .option(
      '--video-max-resolution <res>',
      'Max resolution: 480p, 720p, 1080p, 1440p, 4k'
    )
    .option(
      '--video-fps <n>',
      'Maximum framerate',
      parseInt
    )

    .addHelpText('after', `
Presets:
  balanced  Good quality/size balance (default)
  web       Aggressive compression for web delivery
  mobile    Maximum compression for mobile devices
  archive   Preserve quality, only lossless optimization

Examples:
  # Basic optimization with defaults
  cf optimize character.voxpkg

  # Aggressive compression for web
  cf optimize character.voxpkg --preset web -o character_web.voxpkg

  # Custom image settings
  cf optimize character.voxpkg --image-format png --image-quality 90

  # Skip video processing (faster)
  cf optimize character.voxpkg --skip-video

  # Preview changes first
  cf optimize character.voxpkg --dry-run

Requirements:
  ffmpeg must be installed and available in PATH for audio/video processing.
  Install: brew install ffmpeg (macOS), apt install ffmpeg (Linux)
`)

    .action(async (input: string, opts) => {
      // Validate preset
      const validPresets = ['balanced', 'web', 'mobile', 'archive'];
      if (!validPresets.includes(opts.preset)) {
        console.error(`Error: Invalid preset "${opts.preset}". Valid options: ${validPresets.join(', ')}`);
        process.exit(1);
      }

      // Validate input file exists
      try {
        await access(input);
      } catch {
        console.error(`Error: Input file not found: ${input}`);
        process.exit(1);
      }

      // Validate image format
      const validImageFormats = ['webp', 'png', 'jpeg'];
      if (opts.imageFormat && !validImageFormats.includes(opts.imageFormat)) {
        console.error(`Error: Invalid image format "${opts.imageFormat}". Valid options: ${validImageFormats.join(', ')}`);
        process.exit(1);
      }

      // Validate audio format
      const validAudioFormats = ['mp3', 'ogg', 'aac', 'flac'];
      if (opts.audioFormat && !validAudioFormats.includes(opts.audioFormat)) {
        console.error(`Error: Invalid audio format "${opts.audioFormat}". Valid options: ${validAudioFormats.join(', ')}`);
        process.exit(1);
      }

      // Validate video codec
      const validVideoCodecs = ['libx264', 'libx265', 'libvpx-vp9'];
      if (opts.videoCodec && !validVideoCodecs.includes(opts.videoCodec)) {
        console.error(`Error: Invalid video codec "${opts.videoCodec}". Valid options: ${validVideoCodecs.join(', ')}`);
        process.exit(1);
      }

      // Validate video resolution
      const validResolutions = ['480p', '720p', '1080p', '1440p', '4k'];
      if (opts.videoMaxResolution && !validResolutions.includes(opts.videoMaxResolution)) {
        console.error(`Error: Invalid video resolution "${opts.videoMaxResolution}". Valid options: ${validResolutions.join(', ')}`);
        process.exit(1);
      }

      // Run optimization
      try {
        const report = await optimize(input, {
          output: opts.output,
          preset: opts.preset,
          dryRun: opts.dryRun,
          verbose: opts.verbose,
          json: opts.json,
          skipImages: opts.skipImages,
          skipAudio: opts.skipAudio,
          skipVideo: opts.skipVideo,
          imageFormat: opts.imageFormat,
          imageQuality: opts.imageQuality,
          imageMaxDimension: opts.imageMaxDimension,
          imageMaxMegapixels: opts.imageMaxMegapixels,
          audioFormat: opts.audioFormat,
          audioBitrate: opts.audioBitrate,
          audioChannels: opts.audioChannels,
          audioSampleRate: opts.audioSampleRate,
          videoCodec: opts.videoCodec,
          videoCrf: opts.videoCrf,
          videoMaxResolution: opts.videoMaxResolution,
          videoFps: opts.videoFps,
        });

        // Exit with error if there were failures
        if (report.errors.length > 0 && !opts.json) {
          process.exit(1);
        }
      } catch (err) {
        if (opts.json) {
          console.log(JSON.stringify({
            success: false,
            error: err instanceof Error ? err.message : String(err),
          }, null, 2));
        } else {
          console.error('Error:', err instanceof Error ? err.message : String(err));
        }
        process.exit(1);
      }
    });

  return cmd;
}
