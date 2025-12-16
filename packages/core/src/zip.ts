/**
 * ZIP Utility Functions
 *
 * Handles ZIP format detection and SFX (self-extracting) archive support.
 * Uses Uint8Array for universal browser/Node.js compatibility.
 */

import { indexOf, concat, type BinaryData } from './binary.js';
import { Unzip, UnzipInflate, UnzipPassThrough, type Unzipped, type UnzipFile } from 'fflate';

// ZIP local file header signature: PK\x03\x04
export const ZIP_SIGNATURE = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

// JPEG signatures
export const JPEG_SIGNATURE = new Uint8Array([0xff, 0xd8, 0xff]);

/**
 * How to handle unsafe paths (with .. or absolute paths) during extraction.
 *
 * - 'skip': Silently skip unsafe files (default, backwards compatible)
 * - 'warn': Skip and call onUnsafePath callback for logging/monitoring
 * - 'reject': Throw ZipPreflightError immediately (strictest, recommended for untrusted input)
 */
export type UnsafePathHandling = 'skip' | 'warn' | 'reject';

/**
 * Size limits for ZIP operations
 */
export interface ZipSizeLimits {
  /** Max size per file (default 50MB) */
  maxFileSize: number;
  /** Max total size (default 200MB) */
  maxTotalSize: number;
  /** Max number of files (default 1000) */
  maxFiles: number;
  /**
   * How to handle files with unsafe paths (path traversal attempts).
   *
   * Default: 'skip' (backwards compatible - silently ignores unsafe paths)
   * Recommended: 'reject' for untrusted input (throws on path traversal)
   *
   * @security Path traversal (../) in ZIP entries can lead to arbitrary file
   * overwrites when extracted to disk. While this library returns files in
   * memory, consumers may write to disk using the paths.
   */
  unsafePathHandling?: UnsafePathHandling;
  /**
   * Callback invoked when unsafe path is detected (only with 'warn' handling).
   * Use for logging/monitoring path traversal attempts.
   */
  onUnsafePath?: (path: string, reason: string) => void;
}

export const DEFAULT_ZIP_LIMITS: ZipSizeLimits = {
  maxFileSize: 50 * 1024 * 1024,   // 50MB per file (Risu standard)
  maxTotalSize: 500 * 1024 * 1024, // 500MB total (CharX can have many expression assets)
  maxFiles: 10000,                 // CharX cards can have 2k+ expression assets
  unsafePathHandling: 'skip',      // Backwards compatible default
};

/**
 * Check if a buffer contains ZIP data (anywhere in the buffer).
 * This handles both regular ZIPs and SFX (self-extracting) archives.
 * @param data - Binary data to check
 * @returns true if ZIP signature found
 */
export function isZipBuffer(data: BinaryData): boolean {
  return indexOf(data, ZIP_SIGNATURE) >= 0;
}

/**
 * Check if a buffer starts with ZIP signature (standard ZIP detection).
 * @param data - Binary data to check
 * @returns true if data starts with PK\x03\x04
 */
export function startsWithZipSignature(data: BinaryData): boolean {
  return (
    data.length >= 4 &&
    data[0] === 0x50 &&
    data[1] === 0x4b &&
    data[2] === 0x03 &&
    data[3] === 0x04
  );
}

/**
 * Check if data starts with JPEG signature
 */
export function isJPEG(data: BinaryData): boolean {
  return (
    data.length >= 3 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff
  );
}

/**
 * Check if data is a JPEG with appended ZIP (JPEG+CharX hybrid)
 */
export function isJpegCharX(data: BinaryData): boolean {
  if (!isJPEG(data)) return false;
  // Look for ZIP signature after JPEG data
  return indexOf(data, ZIP_SIGNATURE) > 0;
}

/**
 * Find ZIP data start in buffer (handles SFX/self-extracting archives).
 * SFX archives have an executable stub prepended to the ZIP data.
 *
 * @param data - Binary data that may contain ZIP data (possibly with SFX prefix)
 * @returns Binary data starting at ZIP signature, or original data if not found/already at start
 */
export function findZipStart(data: BinaryData): BinaryData {
  const index = indexOf(data, ZIP_SIGNATURE);

  if (index > 0) {
    // SFX archive detected - return data starting at ZIP signature
    return data.subarray(index);
  }

  // Either ZIP starts at 0, or no ZIP signature found - return original
  return data;
}

/**
 * Get the offset of ZIP data within a buffer.
 * @param data - Binary data to search
 * @returns Offset of ZIP signature, or -1 if not found
 */
export function getZipOffset(data: BinaryData): number {
  return indexOf(data, ZIP_SIGNATURE);
}

/**
 * Check if data is a valid ZIP archive (has signature at start or is SFX)
 * @param data - Binary data to check
 * @returns true if data contains valid ZIP structure
 */
export function isValidZip(data: BinaryData): boolean {
  const offset = getZipOffset(data);
  if (offset < 0) return false;

  // Check if there's enough data after the signature for a minimal ZIP
  // Minimum ZIP: local file header (30 bytes) + central directory (46 bytes) + end of central dir (22 bytes)
  return data.length - offset >= 98;
}

/**
 * Validate a path for directory traversal attacks
 * @param path - File path to validate
 * @returns true if path is safe
 */
export function isPathSafe(path: string): boolean {
  // Reject absolute paths
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) {
    return false;
  }

  // Reject path traversal
  if (path.includes('..')) {
    return false;
  }

  // Reject backslashes (Windows-style paths that might be used for traversal)
  if (path.includes('\\')) {
    return false;
  }

  return true;
}

/**
 * ZIP Central Directory File Header structure
 */
export interface ZipCentralDirEntry {
  fileName: string;
  compressedSize: number;
  uncompressedSize: number;
}

/**
 * Result of preflight ZIP size check
 */
export interface ZipPreflightResult {
  entries: ZipCentralDirEntry[];
  totalUncompressedSize: number;
  fileCount: number;
}

/**
 * Error thrown when ZIP preflight fails due to size limits
 */
export class ZipPreflightError extends Error {
  constructor(
    message: string,
    public readonly totalSize?: number,
    public readonly maxSize?: number,
    public readonly oversizedEntry?: string,
    public readonly entrySize?: number,
    public readonly maxEntrySize?: number
  ) {
    super(message);
    this.name = 'ZipPreflightError';
  }
}

/**
 * Preflight check ZIP central directory to get uncompressed sizes BEFORE extraction.
 * This prevents zip bomb attacks by rejecting archives with dangerous compression ratios
 * or oversized entries without fully decompressing them.
 *
 * The ZIP format stores uncompressed sizes in the central directory at the end of the file.
 * This function reads that metadata without decompressing any actual data.
 *
 * @param data - ZIP file data (can be SFX/self-extracting, will find ZIP start)
 * @param limits - Size limits to enforce
 * @returns Preflight result with entry info and totals
 * @throws ZipPreflightError if limits would be exceeded
 */
export function preflightZipSizes(
  data: BinaryData,
  limits: ZipSizeLimits = DEFAULT_ZIP_LIMITS
): ZipPreflightResult {
  // Find ZIP start (handles SFX/hybrid archives)
  const zipData = findZipStart(data);

  // Find End of Central Directory (EOCD) signature: PK\x05\x06
  // EOCD is at the end of the file, max comment size is 65535 bytes
  const eocdSignature = new Uint8Array([0x50, 0x4b, 0x05, 0x06]);
  const searchStart = Math.max(0, zipData.length - 65535 - 22);

  let eocdOffset = -1;
  for (let i = zipData.length - 22; i >= searchStart; i--) {
    if (
      zipData[i] === eocdSignature[0] &&
      zipData[i + 1] === eocdSignature[1] &&
      zipData[i + 2] === eocdSignature[2] &&
      zipData[i + 3] === eocdSignature[3]
    ) {
      // SECURITY: Validate comment length to avoid false positives
      // If the ZIP comment contains the EOCD signature bytes, we could
      // find the wrong location. Verify by checking comment length.
      // Comment length is at offset +20 (2 bytes, little-endian)
      if (i + 21 < zipData.length) {
        const commentLength = zipData[i + 20]! | (zipData[i + 21]! << 8);
        // True EOCD should be at: file_size - 22 - comment_length
        const expectedOffset = zipData.length - 22 - commentLength;
        if (i === expectedOffset) {
          eocdOffset = i;
          break;
        }
        // Otherwise, this is a false positive (signature in comment), continue searching
      }
    }
  }

  if (eocdOffset < 0) {
    throw new ZipPreflightError('Invalid ZIP: End of Central Directory not found');
  }

  // Parse EOCD
  // Offset 8: Total number of central directory records
  // Offset 12: Size of central directory
  // Offset 16: Offset of start of central directory
  const totalEntries = zipData[eocdOffset + 8]! | (zipData[eocdOffset + 9]! << 8);
  const cdSize = readUInt32LEFromBytes(zipData, eocdOffset + 12);
  const cdOffset = readUInt32LEFromBytes(zipData, eocdOffset + 16);

  // Check file count limit
  if (totalEntries > limits.maxFiles) {
    throw new ZipPreflightError(
      `ZIP contains ${totalEntries} files, exceeds limit of ${limits.maxFiles}`,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );
  }

  // Parse Central Directory entries
  const entries: ZipCentralDirEntry[] = [];
  let totalUncompressedSize = 0;
  let offset = cdOffset;

  for (let i = 0; i < totalEntries && offset < eocdOffset; i++) {
    // Central Directory File Header signature: PK\x01\x02
    if (
      zipData[offset] !== 0x50 ||
      zipData[offset + 1] !== 0x4b ||
      zipData[offset + 2] !== 0x01 ||
      zipData[offset + 3] !== 0x02
    ) {
      throw new ZipPreflightError('Invalid ZIP: Central Directory header corrupted');
    }

    // Offset 20: Compressed size (4 bytes)
    const compressedSize = readUInt32LEFromBytes(zipData, offset + 20);
    // Offset 24: Uncompressed size (4 bytes)
    const uncompressedSize = readUInt32LEFromBytes(zipData, offset + 24);
    // Offset 28: File name length (2 bytes)
    const fileNameLength = zipData[offset + 28]! | (zipData[offset + 29]! << 8);
    // Offset 30: Extra field length (2 bytes)
    const extraLength = zipData[offset + 30]! | (zipData[offset + 31]! << 8);
    // Offset 32: File comment length (2 bytes)
    const commentLength = zipData[offset + 32]! | (zipData[offset + 33]! << 8);

    // Read file name
    const fileName = new TextDecoder().decode(
      zipData.subarray(offset + 46, offset + 46 + fileNameLength)
    );

    // Skip directories (names ending with /)
    if (!fileName.endsWith('/')) {
      // Check per-entry size limit
      if (uncompressedSize > limits.maxFileSize) {
        throw new ZipPreflightError(
          `File "${fileName}" uncompressed size ${uncompressedSize} exceeds limit ${limits.maxFileSize}`,
          undefined,
          undefined,
          fileName,
          uncompressedSize,
          limits.maxFileSize
        );
      }

      totalUncompressedSize += uncompressedSize;

      // Check total size limit early to fail fast
      if (totalUncompressedSize > limits.maxTotalSize) {
        throw new ZipPreflightError(
          `Total uncompressed size ${totalUncompressedSize} exceeds limit ${limits.maxTotalSize}`,
          totalUncompressedSize,
          limits.maxTotalSize
        );
      }

      entries.push({
        fileName,
        compressedSize,
        uncompressedSize,
      });
    }

    // Move to next entry
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return {
    entries,
    totalUncompressedSize,
    fileCount: entries.length,
  };
}

/**
 * Read a 32-bit little-endian unsigned integer from bytes
 */
function readUInt32LEFromBytes(data: BinaryData, offset: number): number {
  return (
    data[offset]! |
    (data[offset + 1]! << 8) |
    (data[offset + 2]! << 16) |
    (data[offset + 3]! << 24)
  ) >>> 0; // Convert to unsigned
}

/**
 * Streaming ZIP extraction with real-time byte limit enforcement.
 *
 * Unlike preflightZipSizes which only checks central directory metadata,
 * this function tracks ACTUAL decompressed bytes during extraction and
 * aborts immediately if limits are exceeded. This protects against
 * malicious archives that lie about sizes in their central directory.
 *
 * @security Path safety is enforced based on `limits.unsafePathHandling`:
 * - 'skip' (default): Silently ignores files with unsafe paths
 * - 'warn': Skips unsafe files and calls onUnsafePath callback
 * - 'reject': Throws ZipPreflightError on unsafe paths
 *
 * @performance SYNCHRONOUS BLOCKING OPERATION
 * This function runs synchronously and will block the event loop during
 * decompression. For large archives (>50MB), this can cause UI freezes
 * in browser environments or block the Node.js event loop.
 *
 * Recommendations:
 * - Browser: Use Web Workers for archives >10MB to avoid freezing the UI
 * - Node.js: Consider worker threads for archives >50MB
 * - All environments: Call preflightZipSizes() first to validate before extraction
 *
 * @param data - ZIP file data (can be SFX/self-extracting)
 * @param limits - Size limits to enforce
 * @returns Extracted files (synchronously)
 * @throws ZipPreflightError if limits are exceeded during extraction
 */
export function streamingUnzipSync(
  data: BinaryData,
  limits: ZipSizeLimits = DEFAULT_ZIP_LIMITS
): Unzipped {
  // Find ZIP start (handles SFX/hybrid archives)
  const zipData = findZipStart(data);

  const result: Unzipped = {};
  let totalBytes = 0;
  let fileCount = 0;
  let error: Error | null = null;

  // Get path handling mode (default to 'skip' for backwards compatibility)
  const unsafePathHandling = limits.unsafePathHandling ?? 'skip';

  // Track chunks per file for concatenation
  const fileChunks = new Map<string, Uint8Array[]>();

  const unzipper = new Unzip((file: UnzipFile) => {
    if (error) return;

    // Skip directories
    if (file.name.endsWith('/')) {
      file.start();
      return;
    }

    // SECURITY: Check for path traversal attacks
    if (!isPathSafe(file.name)) {
      const reason = file.name.includes('..')
        ? 'path traversal (..)'
        : file.name.startsWith('/') || /^[a-zA-Z]:/.test(file.name)
          ? 'absolute path'
          : 'backslash in path';

      if (unsafePathHandling === 'reject') {
        error = new ZipPreflightError(
          `Unsafe path detected: "${file.name}" - ${reason}. ` +
          `This may be a path traversal attack.`
        );
        file.terminate();
        return;
      }

      if (unsafePathHandling === 'warn' && limits.onUnsafePath) {
        limits.onUnsafePath(file.name, reason);
      }

      // Skip this file (consume but don't store) for 'skip' and 'warn' modes
      // SECURITY: Still count bytes to prevent zip bombs hidden behind unsafe paths
      file.ondata = (err, chunk, _final) => {
        if (error) return;
        if (err) {
          error = err;
          return;
        }
        if (chunk && chunk.length > 0) {
          totalBytes += chunk.length;
          if (totalBytes > limits.maxTotalSize) {
            error = new ZipPreflightError(
              `Total actual size ${totalBytes} exceeds limit ${limits.maxTotalSize}`,
              totalBytes,
              limits.maxTotalSize
            );
            file.terminate();
          }
        }
      };
      file.start();
      return;
    }

    fileCount++;
    if (fileCount > limits.maxFiles) {
      error = new ZipPreflightError(
        `File count ${fileCount} exceeds limit ${limits.maxFiles}`
      );
      file.terminate();
      return;
    }

    const chunks: Uint8Array[] = [];
    fileChunks.set(file.name, chunks);
    let fileBytes = 0;

    file.ondata = (err, chunk, final) => {
      if (error) return;

      if (err) {
        error = err;
        return;
      }

      if (chunk && chunk.length > 0) {
        fileBytes += chunk.length;
        totalBytes += chunk.length;

        // Check per-file size limit (actual decompressed bytes)
        if (fileBytes > limits.maxFileSize) {
          error = new ZipPreflightError(
            `File "${file.name}" actual size ${fileBytes} exceeds limit ${limits.maxFileSize}`,
            undefined,
            undefined,
            file.name,
            fileBytes,
            limits.maxFileSize
          );
          file.terminate();
          return;
        }

        // Check total size limit (actual decompressed bytes)
        if (totalBytes > limits.maxTotalSize) {
          error = new ZipPreflightError(
            `Total actual size ${totalBytes} exceeds limit ${limits.maxTotalSize}`,
            totalBytes,
            limits.maxTotalSize
          );
          file.terminate();
          return;
        }

        chunks.push(chunk);
      }

      if (final && !error) {
        // Concatenate all chunks for this file
        result[file.name] = concat(...chunks);
      }
    };

    file.start();
  });

  // Register decompression handlers
  unzipper.register(UnzipInflate);     // DEFLATE (compression method 8)
  unzipper.register(UnzipPassThrough); // Stored (compression method 0)

  // Push all data - fflate processes synchronously when given full buffer
  unzipper.push(zipData, true);

  // If an error occurred during processing, throw it
  if (error) {
    throw error;
  }

  return result;
}

/**
 * Re-export Unzipped type for convenience
 */
export type { Unzipped };
