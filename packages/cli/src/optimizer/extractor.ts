/**
 * Package Extractor
 *
 * Extracts voxpkg/charx packages to temp directories for processing.
 */

import { readFile, writeFile, mkdir, rm, readdir, stat } from 'node:fs/promises';
import { join, basename, extname, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { unzipSync, zipSync, type Unzipped, type Zippable, type ZipOptions } from 'fflate';

export type PackageFormat = 'voxpkg' | 'charx' | 'unknown';
export type AssetType = 'image' | 'audio' | 'video' | 'other';

export interface AssetInfo {
  /** Original path within the package */
  path: string;
  /** Absolute path in temp directory */
  absolutePath: string;
  /** Asset type: image, audio, video, or other */
  type: AssetType;
  /** File extension without dot */
  ext: string;
  /** File size in bytes */
  size: number;
  /** Image dimensions if applicable */
  dimensions?: { width: number; height: number };
  /** Duration in seconds for audio/video */
  duration?: number;
}

export interface ExtractedPackage {
  /** Detected format */
  format: PackageFormat;
  /** Temp directory containing extracted files */
  tempDir: string;
  /** List of all assets with metadata */
  assets: AssetInfo[];
  /** Non-asset files (JSON metadata, etc.) */
  metaFiles: string[];
  /** Total original size */
  totalSize: number;
}

export interface PathRemap {
  /** Original path in package */
  oldPath: string;
  /** New path after optimization */
  newPath: string;
}

// MIME type mapping for format changes
const MIME_TYPES: Record<string, string> = {
  // Images
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'bmp': 'image/bmp',
  'svg': 'image/svg+xml',
  // Audio
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'ogg': 'audio/ogg',
  'flac': 'audio/flac',
  'aac': 'audio/aac',
  'm4a': 'audio/mp4',
  // Video
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'mkv': 'video/x-matroska',
  'avi': 'video/x-msvideo',
  'mov': 'video/quicktime',
};

/**
 * Update JSON files with new asset paths after extension changes
 */
export async function updateJsonReferences(
  tempDir: string,
  metaFiles: string[],
  remaps: PathRemap[]
): Promise<void> {
  if (remaps.length === 0) return;

  // Build a map of old extension -> new extension for MIME type updates
  const extChanges: Map<string, string> = new Map();
  for (const remap of remaps) {
    const oldExt = extname(remap.oldPath).slice(1).toLowerCase();
    const newExt = extname(remap.newPath).slice(1).toLowerCase();
    if (oldExt !== newExt) {
      extChanges.set(oldExt, newExt);
    }
  }

  for (const metaFile of metaFiles) {
    if (!metaFile.endsWith('.json')) continue;

    const filePath = join(tempDir, metaFile);
    try {
      const content = await readFile(filePath, 'utf-8');
      let updated = content;

      // Replace all old paths with new paths
      for (const remap of remaps) {
        // Handle both with and without leading slashes
        const oldPathVariants = [
          remap.oldPath,
          `/${remap.oldPath}`,
          remap.oldPath.replace(/\//g, '\\\\'), // Windows-style in JSON
        ];

        for (const oldVariant of oldPathVariants) {
          // Use regex to handle JSON escaping
          const escapedOld = oldVariant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const newPath = remap.newPath.replace(
            /\//g,
            oldVariant.includes('\\\\') ? '\\\\' : '/'
          );
          updated = updated.replace(new RegExp(escapedOld, 'g'), newPath);
        }

        // Also handle just the filename change (common in character.json)
        const oldFilename = basename(remap.oldPath);
        const newFilename = basename(remap.newPath);
        if (oldFilename !== newFilename) {
          // Be careful to only replace in asset path contexts
          const filenamePattern = new RegExp(
            `"([^"]*[/\\\\])?(${oldFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})"`,
            'g'
          );
          updated = updated.replace(filenamePattern, (match, prefix) => {
            if (prefix) {
              return `"${prefix}${newFilename}"`;
            }
            return `"${newFilename}"`;
          });
        }
      }

      // Update MIME types (ContentType fields)
      for (const [oldExt, newExt] of extChanges) {
        const oldMime = MIME_TYPES[oldExt];
        const newMime = MIME_TYPES[newExt];
        if (oldMime && newMime && oldMime !== newMime) {
          // Replace ContentType values
          updated = updated.replace(
            new RegExp(`"ContentType"\\s*:\\s*"${oldMime}"`, 'g'),
            `"ContentType":"${newMime}"`
          );
          // Also handle content-type (lowercase)
          updated = updated.replace(
            new RegExp(`"content-type"\\s*:\\s*"${oldMime}"`, 'gi'),
            `"content-type":"${newMime}"`
          );
          // Handle mimeType field
          updated = updated.replace(
            new RegExp(`"mimeType"\\s*:\\s*"${oldMime}"`, 'g'),
            `"mimeType":"${newMime}"`
          );
          // Handle type field that looks like a MIME type
          updated = updated.replace(
            new RegExp(`"type"\\s*:\\s*"${oldMime}"`, 'g'),
            `"type":"${newMime}"`
          );
        }
      }

      if (updated !== content) {
        await writeFile(filePath, updated);
      }
    } catch {
      // Skip files that can't be read/parsed
    }
  }
}

// Extension to type mapping
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff', 'ico', 'svg']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'm4v']);
const META_EXTENSIONS = new Set(['json', 'txt', 'md', 'xml', 'yaml', 'yml']);

/**
 * Detect asset type from file extension
 */
export function detectAssetType(filename: string): AssetType {
  const ext = extname(filename).toLowerCase().slice(1);
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  return 'other';
}

/**
 * Detect package format from file data
 */
export function detectFormat(data: Uint8Array): PackageFormat {
  // Check for ZIP signature
  if (data[0] !== 0x50 || data[1] !== 0x4b) {
    return 'unknown';
  }

  // Try to unzip and check for format markers
  try {
    const unzipped = unzipSync(data);
    const paths = Object.keys(unzipped);

    // Voxta: Characters/, Books/, Scenarios/, Collections/, package.json
    if (
      paths.some((p) => p.startsWith('Characters/')) ||
      paths.some((p) => p.startsWith('Books/')) ||
      paths.some((p) => p === 'package.json')
    ) {
      return 'voxpkg';
    }

    // CharX: card.json, assets/
    if (
      paths.some((p) => p === 'card.json') ||
      paths.some((p) => p.startsWith('assets/'))
    ) {
      return 'charx';
    }
  } catch {
    return 'unknown';
  }

  return 'unknown';
}

/**
 * Check if a path is a metadata file
 */
function isMetaFile(path: string): boolean {
  const ext = extname(path).toLowerCase().slice(1);
  return META_EXTENSIONS.has(ext);
}

/**
 * Extract a package to a temporary directory
 */
export async function extractPackage(inputPath: string): Promise<ExtractedPackage> {
  const data = new Uint8Array(await readFile(inputPath));
  const format = detectFormat(data);

  if (format === 'unknown') {
    throw new Error(`Unknown package format: ${inputPath}`);
  }

  // Create temp directory
  const tempDir = join(tmpdir(), `cf-optimize-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });

  // Unzip
  const unzipped = unzipSync(data);
  const assets: AssetInfo[] = [];
  const metaFiles: string[] = [];
  let totalSize = 0;

  // Write all files and categorize
  for (const [path, content] of Object.entries(unzipped)) {
    // Skip directories (empty entries)
    if (path.endsWith('/') || content.length === 0) continue;

    const absolutePath = join(tempDir, path);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);

    totalSize += content.length;

    if (isMetaFile(path)) {
      metaFiles.push(path);
    } else {
      const type = detectAssetType(path);
      const ext = extname(path).toLowerCase().slice(1);

      assets.push({
        path,
        absolutePath,
        type,
        ext,
        size: content.length,
      });
    }
  }

  return {
    format,
    tempDir,
    assets,
    metaFiles,
    totalSize,
  };
}

/**
 * Repack a package from a temp directory
 */
export async function repackPackage(
  extracted: ExtractedPackage,
  outputPath: string,
  compressionLevel: number = 6
): Promise<number> {
  const zipEntries: Zippable = {};

  // Recursively read all files from temp directory
  async function addDir(dir: string, prefix: string = ''): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const zipPath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await addDir(fullPath, zipPath);
      } else {
        const content = await readFile(fullPath);
        zipEntries[zipPath] = [new Uint8Array(content), { level: compressionLevel as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }];
      }
    }
  }

  await addDir(extracted.tempDir);

  // Create ZIP
  const zipped = zipSync(zipEntries);

  // Write output
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, zipped);

  return zipped.length;
}

/**
 * Clean up temp directory
 */
export async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    await rm(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Get categorized asset summary
 */
export function getAssetSummary(assets: AssetInfo[]): {
  images: { count: number; size: number };
  audio: { count: number; size: number };
  video: { count: number; size: number };
  other: { count: number; size: number };
} {
  const summary = {
    images: { count: 0, size: 0 },
    audio: { count: 0, size: 0 },
    video: { count: 0, size: 0 },
    other: { count: 0, size: 0 },
  };

  for (const asset of assets) {
    switch (asset.type) {
      case 'image':
        summary.images.count++;
        summary.images.size += asset.size;
        break;
      case 'audio':
        summary.audio.count++;
        summary.audio.size += asset.size;
        break;
      case 'video':
        summary.video.count++;
        summary.video.size += asset.size;
        break;
      default:
        summary.other.count++;
        summary.other.size += asset.size;
    }
  }

  return summary;
}
