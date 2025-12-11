/**
 * Voxta Reader
 *
 * Extracts and parses .voxpkg files.
 */

import {
  type BinaryData,
  type Unzipped,
  toString,
  findZipStart,
  getZipOffset,
  streamingUnzipSync,
  ZipPreflightError,
  ParseError,
  SizeLimitError,
} from '@character-foundry/core';
import type {
  VoxtaData,
  VoxtaReadOptions,
  ExtractedVoxtaCharacter,
  ExtractedVoxtaScenario,
  ExtractedVoxtaBook,
  VoxtaPackage,
  VoxtaCharacter,
  VoxtaScenario,
  VoxtaBook,
} from './types.js';

const DEFAULT_OPTIONS: Required<VoxtaReadOptions> = {
  maxFileSize: 50 * 1024 * 1024,    // 50MB
  maxAssetSize: 50 * 1024 * 1024,   // 50MB
  maxTotalSize: 500 * 1024 * 1024,  // 500MB - Voxta packages can be large
};

// ZIP End of Central Directory signature
const EOCD_SIGNATURE = new Uint8Array([0x50, 0x4b, 0x05, 0x06]);
// ZIP Central Directory File Header signature
const CDFH_SIGNATURE = new Uint8Array([0x50, 0x4b, 0x01, 0x02]);

/**
 * Scan ZIP central directory for filenames matching Voxta markers.
 * The central directory is at the END of the ZIP file, so we must parse
 * the EOCD record to find it.
 */
function scanZipCentralDirectory(zipData: BinaryData, markers: string[]): boolean {
  // Find EOCD (End of Central Directory) - scan from end
  // EOCD is at least 22 bytes, search within last 64KB (comment can be up to 64KB)
  const searchSize = Math.min(zipData.length, 65536 + 22);
  let eocdOffset = -1;

  for (let i = zipData.length - 22; i >= zipData.length - searchSize; i--) {
    if (
      zipData[i] === EOCD_SIGNATURE[0] &&
      zipData[i + 1] === EOCD_SIGNATURE[1] &&
      zipData[i + 2] === EOCD_SIGNATURE[2] &&
      zipData[i + 3] === EOCD_SIGNATURE[3]
    ) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset < 0) return false;

  // EOCD structure (22 bytes minimum):
  // 0-3:   signature (PK\x05\x06)
  // 4-5:   disk number
  // 6-7:   disk with central directory
  // 8-9:   entries on this disk
  // 10-11: total entries
  // 12-15: central directory size
  // 16-19: central directory offset
  // 20-21: comment length

  // Read central directory offset (little-endian uint32 at offset 16)
  const cdOffset =
    zipData[eocdOffset + 16]! |
    (zipData[eocdOffset + 17]! << 8) |
    (zipData[eocdOffset + 18]! << 16) |
    (zipData[eocdOffset + 19]! << 24);

  // Read number of entries (little-endian uint16 at offset 10)
  const numEntries = zipData[eocdOffset + 10]! | (zipData[eocdOffset + 11]! << 8);

  if (cdOffset < 0 || cdOffset >= zipData.length) return false;

  // Iterate through central directory entries
  let pos = cdOffset;
  const decoder = new TextDecoder();

  for (let entry = 0; entry < numEntries && pos < eocdOffset; entry++) {
    // Verify CDFH signature
    if (
      zipData[pos] !== CDFH_SIGNATURE[0] ||
      zipData[pos + 1] !== CDFH_SIGNATURE[1] ||
      zipData[pos + 2] !== CDFH_SIGNATURE[2] ||
      zipData[pos + 3] !== CDFH_SIGNATURE[3]
    ) {
      break; // Invalid entry, stop parsing
    }

    // Central Directory File Header structure:
    // 0-3:   signature
    // 4-5:   version made by
    // 6-7:   version needed
    // 8-9:   flags
    // 10-11: compression method
    // 12-13: last mod time
    // 14-15: last mod date
    // 16-19: CRC-32
    // 20-23: compressed size
    // 24-27: uncompressed size
    // 28-29: filename length
    // 30-31: extra field length
    // 32-33: comment length
    // 34-35: disk number start
    // 36-37: internal attributes
    // 38-41: external attributes
    // 42-45: local header offset
    // 46+:   filename, extra field, comment

    const fileNameLen = zipData[pos + 28]! | (zipData[pos + 29]! << 8);
    const extraLen = zipData[pos + 30]! | (zipData[pos + 31]! << 8);
    const commentLen = zipData[pos + 32]! | (zipData[pos + 33]! << 8);

    if (pos + 46 + fileNameLen > zipData.length) break;

    // Extract filename
    const fileName = decoder.decode(zipData.subarray(pos + 46, pos + 46 + fileNameLen));

    // Check against markers
    for (const marker of markers) {
      if (fileName === marker || fileName.startsWith(marker)) {
        return true;
      }
    }

    // Move to next entry
    pos += 46 + fileNameLen + extraLen + commentLen;
  }

  return false;
}

/**
 * Check if data is a Voxta package
 */
export function isVoxta(data: BinaryData): boolean {
  const zipOffset = getZipOffset(data);
  if (zipOffset < 0) return false;

  const zipData = data.subarray(zipOffset);

  // Voxta markers - package.json is the primary indicator
  const markers = [
    'package.json',
    'character.json',
    'Characters/',
    'MemoryBooks/',
    'Scenarios/',
  ];

  return scanZipCentralDirectory(zipData, markers);
}

/**
 * Extract and parse a Voxta package
 */
export function readVoxta(
  data: BinaryData,
  options: VoxtaReadOptions = {}
): VoxtaData {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // SECURITY: Streaming unzip with real-time byte limit enforcement
  // This tracks ACTUAL decompressed bytes and aborts if limits exceeded,
  // protecting against malicious archives that lie about sizes in central directory
  let unzipped: Unzipped;
  try {
    unzipped = streamingUnzipSync(data, {
      maxFileSize: opts.maxAssetSize,
      maxTotalSize: opts.maxTotalSize,
      maxFiles: 10000, // Voxta packages can have many files
    });
  } catch (err) {
    if (err instanceof ZipPreflightError) {
      throw new SizeLimitError(
        err.totalSize || err.entrySize || 0,
        err.maxSize || err.maxEntrySize || opts.maxTotalSize,
        err.oversizedEntry || 'Voxta package'
      );
    }
    throw new ParseError(
      `Failed to unzip Voxta package: ${err instanceof Error ? err.message : String(err)}`,
      'voxta'
    );
  }

  const result: VoxtaData = {
    characters: [],
    scenarios: [],
    books: [],
    exportType: 'character', // Default, will be updated based on contents
  };

  // Temporary maps to aggregate data parts
  const charMap = new Map<string, Partial<ExtractedVoxtaCharacter>>();
  const scenarioMap = new Map<string, Partial<ExtractedVoxtaScenario>>();
  const bookMap = new Map<string, Partial<ExtractedVoxtaBook>>();

  // Process entries (size limits already enforced by streamingUnzipSync)
  for (const [fileName, fileData] of Object.entries(unzipped)) {
    // Skip directories
    if (fileName.endsWith('/') || fileData.length === 0) continue;

    // 1. Package Metadata
    if (fileName === 'package.json') {
      if (fileData.length > opts.maxFileSize) {
        throw new SizeLimitError(fileData.length, opts.maxFileSize, 'package.json');
      }
      try {
        result.package = JSON.parse(toString(fileData)) as VoxtaPackage;
      } catch (err) {
        throw new ParseError(
          `Failed to parse package.json: ${err instanceof Error ? err.message : String(err)}`,
          'voxta'
        );
      }
      continue;
    }

    // 2. Characters - Path: Characters/{uuid}/...
    const charMatch = fileName.match(/^Characters\/([^/]+)\/(.+)$/);
    if (charMatch) {
      const [, charId, subPath] = charMatch;

      if (!charMap.has(charId!)) {
        charMap.set(charId!, { id: charId, assets: [] });
      }
      const charEntry = charMap.get(charId!)!;

      if (subPath === 'character.json') {
        try {
          charEntry.data = JSON.parse(toString(fileData)) as VoxtaCharacter;
        } catch (err) {
          throw new ParseError(
            `Failed to parse character.json for ${charId}: ${err instanceof Error ? err.message : String(err)}`,
            'voxta'
          );
        }
      } else if (subPath!.startsWith('thumbnail.')) {
        charEntry.thumbnail = fileData;
      } else if (subPath!.startsWith('Assets/')) {
        charEntry.assets!.push({
          path: subPath!,
          buffer: fileData,
          characterId: charId,
        });
      }
      continue;
    }

    // 3. Scenarios - Path: Scenarios/{uuid}/...
    const scenarioMatch = fileName.match(/^Scenarios\/([^/]+)\/(.+)$/);
    if (scenarioMatch) {
      const [, scenarioId, subPath] = scenarioMatch;

      if (!scenarioMap.has(scenarioId!)) {
        scenarioMap.set(scenarioId!, { id: scenarioId });
      }
      const scenarioEntry = scenarioMap.get(scenarioId!)!;

      if (subPath === 'scenario.json') {
        try {
          scenarioEntry.data = JSON.parse(toString(fileData)) as VoxtaScenario;
        } catch (err) {
          throw new ParseError(
            `Failed to parse scenario.json for ${scenarioId}: ${err instanceof Error ? err.message : String(err)}`,
            'voxta'
          );
        }
      } else if (subPath!.startsWith('thumbnail.')) {
        scenarioEntry.thumbnail = fileData;
      }
      continue;
    }

    // 4. Books - Path: Books/{uuid}/...
    const bookMatch = fileName.match(/^Books\/([^/]+)\/(.+)$/);
    if (bookMatch) {
      const [, bookId, subPath] = bookMatch;

      if (!bookMap.has(bookId!)) {
        bookMap.set(bookId!, { id: bookId });
      }
      const bookEntry = bookMap.get(bookId!)!;

      if (subPath === 'book.json') {
        try {
          bookEntry.data = JSON.parse(toString(fileData)) as VoxtaBook;
        } catch (err) {
          throw new ParseError(
            `Failed to parse book.json for ${bookId}: ${err instanceof Error ? err.message : String(err)}`,
            'voxta'
          );
        }
      }
      continue;
    }
  }

  // Assemble final results - filter incomplete entries
  for (const [, char] of charMap) {
    if (char.data) {
      result.characters.push(char as ExtractedVoxtaCharacter);
    }
  }

  for (const [, scenario] of scenarioMap) {
    if (scenario.data) {
      result.scenarios.push(scenario as ExtractedVoxtaScenario);
    }
  }

  for (const [, book] of bookMap) {
    if (book.data) {
      result.books.push(book as ExtractedVoxtaBook);
    }
  }

  // Determine export type based on contents
  if (result.package) {
    result.exportType = 'package';
  } else if (result.scenarios.length > 0) {
    result.exportType = 'scenario';
  }
  // else stays 'character' (default)

  return result;
}

/**
 * Async version of readVoxta
 */
export async function readVoxtaAsync(
  data: BinaryData,
  options: VoxtaReadOptions = {}
): Promise<VoxtaData> {
  return readVoxta(data, options);
}
