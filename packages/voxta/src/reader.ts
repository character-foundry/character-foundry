/**
 * Voxta Reader
 *
 * Extracts and parses .voxpkg files.
 */

import { unzipSync, type Unzipped } from 'fflate';
import {
  type BinaryData,
  toString,
  findZipStart,
  getZipOffset,
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

/**
 * Check if data is a Voxta package
 */
export function isVoxta(data: BinaryData): boolean {
  const zipOffset = getZipOffset(data);
  if (zipOffset < 0) return false;

  // Quick check: look for Voxta-specific paths
  const zipData = data.subarray(zipOffset);
  const markers = [
    new TextEncoder().encode('character.json'),
    new TextEncoder().encode('Characters/'),
  ];

  for (const marker of markers) {
    for (let i = 0; i < Math.min(zipData.length - marker.length, 2000); i++) {
      let found = true;
      for (let j = 0; j < marker.length; j++) {
        if (zipData[i + j] !== marker[j]) {
          found = false;
          break;
        }
      }
      if (found) return true;
    }
  }

  return false;
}

/**
 * Extract and parse a Voxta package
 */
export function readVoxta(
  data: BinaryData,
  options: VoxtaReadOptions = {}
): VoxtaData {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Handle SFX archives
  const zipData = findZipStart(data);

  // Unzip
  let unzipped: Unzipped;
  try {
    unzipped = unzipSync(zipData);
  } catch (err) {
    throw new ParseError(
      `Failed to unzip Voxta package: ${err instanceof Error ? err.message : String(err)}`,
      'voxta'
    );
  }

  const result: VoxtaData = {
    characters: [],
    scenarios: [],
    books: [],
  };

  // Temporary maps to aggregate data parts
  const charMap = new Map<string, Partial<ExtractedVoxtaCharacter>>();
  const scenarioMap = new Map<string, Partial<ExtractedVoxtaScenario>>();
  const bookMap = new Map<string, Partial<ExtractedVoxtaBook>>();

  let totalSize = 0;

  // Process entries
  for (const [fileName, fileData] of Object.entries(unzipped)) {
    // Skip directories
    if (fileName.endsWith('/') || fileData.length === 0) continue;

    // Size check
    totalSize += fileData.length;
    if (totalSize > opts.maxTotalSize) {
      throw new SizeLimitError(totalSize, opts.maxTotalSize, 'Total Voxta package size');
    }

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
