/**
 * FFmpeg Wrapper
 *
 * Detection and command execution for ffmpeg.
 */

import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

export interface FfmpegInfo {
  available: boolean;
  version?: string;
  path?: string;
}

export interface FfmpegResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  error?: Error;
}

export interface FfmpegProgress {
  frame?: number;
  fps?: number;
  time?: string;
  bitrate?: string;
  speed?: string;
  size?: number;
}

export type ProgressCallback = (progress: FfmpegProgress) => void;

let cachedInfo: FfmpegInfo | null = null;

/**
 * Check if ffmpeg is available and get version info
 */
export async function checkFfmpeg(): Promise<FfmpegInfo> {
  if (cachedInfo) return cachedInfo;

  try {
    const result = await runFfmpegCommand(['-version']);
    if (result.success) {
      const versionMatch = result.stdout.match(/ffmpeg version (\S+)/);
      cachedInfo = {
        available: true,
        version: versionMatch?.[1],
        path: 'ffmpeg',
      };
      return cachedInfo;
    }
  } catch {
    // ffmpeg not found
  }

  cachedInfo = { available: false };
  return cachedInfo;
}

/**
 * Require ffmpeg to be available, exit with error if not
 */
export async function requireFfmpeg(): Promise<void> {
  const info = await checkFfmpeg();
  if (!info.available) {
    console.error('Error: ffmpeg is required but not found in PATH');
    console.error('');
    console.error('Install ffmpeg:');
    console.error('  macOS:   brew install ffmpeg');
    console.error('  Ubuntu:  sudo apt install ffmpeg');
    console.error('  Windows: winget install ffmpeg');
    console.error('  Arch:    pacman -S ffmpeg');
    process.exit(1);
  }
}

/**
 * Run an ffmpeg command and return the result
 */
export function runFfmpegCommand(args: string[]): Promise<FfmpegResult> {
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        exitCode: 1,
        stdout,
        stderr,
        error: err,
      });
    });
  });
}

/**
 * Run ffmpeg with progress reporting
 */
export function runFfmpegWithProgress(
  args: string[],
  onProgress?: ProgressCallback
): Promise<FfmpegResult> {
  return new Promise((resolve) => {
    // Add -progress pipe:1 to get machine-readable progress
    const fullArgs = ['-progress', 'pipe:1', '-nostats', ...args];

    const proc = spawn('ffmpeg', fullArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
      if (onProgress) {
        const progress = parseProgress(data.toString());
        if (progress) {
          onProgress(progress);
        }
      }
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        exitCode: 1,
        stdout,
        stderr,
        error: err,
      });
    });
  });
}

/**
 * Parse ffmpeg progress output
 */
function parseProgress(output: string): FfmpegProgress | null {
  const progress: FfmpegProgress = {};
  let hasData = false;

  const frameMatch = output.match(/frame=(\d+)/);
  if (frameMatch) {
    progress.frame = parseInt(frameMatch[1]!, 10);
    hasData = true;
  }

  const fpsMatch = output.match(/fps=([\d.]+)/);
  if (fpsMatch) {
    progress.fps = parseFloat(fpsMatch[1]!);
    hasData = true;
  }

  const timeMatch = output.match(/out_time=(\S+)/);
  if (timeMatch && timeMatch[1] !== 'N/A') {
    progress.time = timeMatch[1];
    hasData = true;
  }

  const bitrateMatch = output.match(/bitrate=([\d.]+)kbits\/s/);
  if (bitrateMatch) {
    progress.bitrate = `${bitrateMatch[1]}kbps`;
    hasData = true;
  }

  const speedMatch = output.match(/speed=([\d.]+)x/);
  if (speedMatch) {
    progress.speed = `${speedMatch[1]}x`;
    hasData = true;
  }

  const sizeMatch = output.match(/total_size=(\d+)/);
  if (sizeMatch) {
    progress.size = parseInt(sizeMatch[1]!, 10);
    hasData = true;
  }

  return hasData ? progress : null;
}

/**
 * Get media file duration using ffprobe
 */
export async function getMediaDuration(filePath: string): Promise<number | null> {
  try {
    const result = await runFfprobeCommand([
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);

    if (result.success && result.stdout.trim()) {
      const duration = parseFloat(result.stdout.trim());
      return isNaN(duration) ? null : duration;
    }
  } catch {
    // ffprobe failed
  }
  return null;
}

/**
 * Get video resolution using ffprobe
 */
export async function getVideoResolution(
  filePath: string
): Promise<{ width: number; height: number } | null> {
  try {
    const result = await runFfprobeCommand([
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'csv=s=x:p=0',
      filePath,
    ]);

    if (result.success && result.stdout.trim()) {
      const [width, height] = result.stdout.trim().split('x').map(Number);
      if (width && height) {
        return { width, height };
      }
    }
  } catch {
    // ffprobe failed
  }
  return null;
}

/**
 * Run ffprobe command
 */
function runFfprobeCommand(args: string[]): Promise<FfmpegResult> {
  return new Promise((resolve) => {
    const proc = spawn('ffprobe', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        exitCode: 1,
        stdout,
        stderr,
        error: err,
      });
    });
  });
}
