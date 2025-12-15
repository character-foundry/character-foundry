/**
 * CharX Reader
 *
 * Extracts and parses .charx (ZIP-based character card) files.
 * Supports standard CharX, Risu CharX, and JPEG+ZIP hybrid formats.
 */

import {
  type BinaryData,
  toString,
  base64Decode,
  parseURI,
  ParseError,
  SizeLimitError,
} from '@character-foundry/core';
import {
  type Unzipped,
  findZipStart,
  isJpegCharX,
  getZipOffset,
  streamingUnzipSync,
  ZipPreflightError,
} from '@character-foundry/core/zip';
import type { CCv3Data, AssetDescriptor } from '@character-foundry/schemas';
import { hasRisuExtensions } from '@character-foundry/schemas';
import type {
  CharxData,
  CharxAssetInfo,
  CharxMetaEntry,
  CharxReadOptions,
  AssetFetcher,
} from './types.js';

const DEFAULT_OPTIONS: Required<Omit<CharxReadOptions, 'assetFetcher'>> = {
  maxFileSize: 10 * 1024 * 1024,    // 10MB
  maxAssetSize: 50 * 1024 * 1024,   // 50MB (Risu standard)
  maxTotalSize: 200 * 1024 * 1024,  // 200MB
  preserveXMeta: true,
  preserveModuleRisum: true,
};

/**
 * Check if data is a CharX file (ZIP with card.json)
 *
 * Scans the END of the file (ZIP central directory) since JPEG+ZIP hybrids
 * can have large JPEG data at the front. The central directory listing
 * all filenames is always at the tail of the ZIP.
 */
export function isCharX(data: BinaryData): boolean {
  const zipOffset = getZipOffset(data);
  if (zipOffset < 0) return false;

  const zipData = data.subarray(zipOffset);
  const cardJsonMarker = new TextEncoder().encode('card.json');

  // Scan the last 64KB where the central directory lives
  // (covers ZIP with up to ~1000 files in the directory)
  const scanSize = Math.min(zipData.length, 65536);
  const startOffset = zipData.length - scanSize;

  for (let i = startOffset; i < zipData.length - cardJsonMarker.length; i++) {
    let found = true;
    for (let j = 0; j < cardJsonMarker.length; j++) {
      if (zipData[i + j] !== cardJsonMarker[j]) {
        found = false;
        break;
      }
    }
    if (found) return true;
  }

  return false;
}

/**
 * Check if data is a JPEG+ZIP hybrid (JPEG with appended CharX)
 */
export { isJpegCharX };

/**
 * Extract and parse a CharX buffer
 */
export function readCharX(
  data: BinaryData,
  options: CharxReadOptions = {}
): CharxData {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // SECURITY: Streaming unzip with real-time byte limit enforcement
  // This tracks ACTUAL decompressed bytes and aborts if limits exceeded,
  // protecting against malicious archives that lie about sizes in central directory
  let unzipped: Unzipped;
  try {
    unzipped = streamingUnzipSync(data, {
      maxFileSize: opts.maxAssetSize,
      maxTotalSize: opts.maxTotalSize,
      maxFiles: 10000, // CharX can have many assets
    });
  } catch (err) {
    if (err instanceof ZipPreflightError) {
      throw new SizeLimitError(
        err.totalSize || err.entrySize || 0,
        err.maxSize || err.maxEntrySize || opts.maxTotalSize,
        err.oversizedEntry || 'CharX archive'
      );
    }
    throw new ParseError(
      `Failed to unzip CharX: ${err instanceof Error ? err.message : String(err)}`,
      'charx'
    );
  }

  let cardJson: CCv3Data | null = null;
  const assets: CharxAssetInfo[] = [];
  const metadata = new Map<number, CharxMetaEntry>();
  let moduleRisum: BinaryData | undefined;

  // Process entries (size limits already enforced by streamingUnzipSync)
  for (const [fileName, fileData] of Object.entries(unzipped)) {
    // Skip directories (empty or ends with /)
    if (fileName.endsWith('/') || fileData.length === 0) continue;

    // Handle card.json
    if (fileName === 'card.json') {
      if (fileData.length > opts.maxFileSize) {
        throw new SizeLimitError(fileData.length, opts.maxFileSize, 'card.json');
      }
      try {
        const content = toString(fileData);
        cardJson = JSON.parse(content) as CCv3Data;
      } catch (err) {
        throw new ParseError(
          `Failed to parse card.json: ${err instanceof Error ? err.message : String(err)}`,
          'charx'
        );
      }
      continue;
    }

    // Handle x_meta/*.json
    if (opts.preserveXMeta) {
      const metaMatch = fileName.match(/^x_meta\/(\d+)\.json$/);
      if (metaMatch) {
        const index = parseInt(metaMatch[1]!, 10);
        try {
          const content = toString(fileData);
          const meta = JSON.parse(content) as CharxMetaEntry;
          metadata.set(index, meta);
        } catch {
          // Ignore invalid metadata
        }
        continue;
      }
    }

    // Handle module.risum (Risu scripts)
    if (fileName === 'module.risum' && opts.preserveModuleRisum) {
      moduleRisum = fileData;
      continue;
    }

    // Handle assets/** files
    if (fileName.startsWith('assets/')) {
      const name = fileName.split('/').pop() || 'unknown';
      const ext = name.split('.').pop() || 'bin';

      assets.push({
        path: fileName,
        descriptor: {
          type: 'custom',
          name: name.replace(/\.[^.]+$/, ''), // Remove extension
          uri: `embeded://${fileName}`,
          ext,
        },
        buffer: fileData,
      });
      continue;
    }

    // Unknown files are ignored (readme.txt, etc.)
  }

  if (!cardJson) {
    throw new ParseError('CharX file does not contain card.json', 'charx');
  }

  // Validate that it's a CCv3 card
  if (cardJson.spec !== 'chara_card_v3') {
    throw new ParseError(
      `Invalid card spec: expected "chara_card_v3", got "${cardJson.spec}"`,
      'charx'
    );
  }

  // Match assets to their descriptors from card.json
  const matchedAssets = matchAssetsToDescriptors(assets, cardJson.data.assets || []);

  // Determine if this is a Risu-format CharX
  const isRisuFormat = !!moduleRisum || hasRisuExtensions(cardJson.data.extensions);

  return {
    card: cardJson,
    assets: matchedAssets,
    metadata: metadata.size > 0 ? metadata : undefined,
    moduleRisum,
    isRisuFormat,
  };
}

/**
 * Match extracted asset files to their descriptors from card.json
 *
 * @performance Uses O(1) Map lookup instead of O(n) linear search per descriptor.
 * This reduces complexity from O(n*m) to O(n+m) for large asset packs.
 */
function matchAssetsToDescriptors(
  extractedAssets: CharxAssetInfo[],
  descriptors: AssetDescriptor[]
): CharxAssetInfo[] {
  // Build O(1) lookup map for extracted assets by path
  const assetsByPath = new Map<string, CharxAssetInfo>();
  for (const asset of extractedAssets) {
    assetsByPath.set(asset.path, asset);
  }

  const matched: CharxAssetInfo[] = [];

  for (const descriptor of descriptors) {
    const parsed = parseURI(descriptor.uri);

    if (parsed.scheme === 'embeded' && parsed.path) {
      // O(1) lookup instead of O(n) find
      const asset = assetsByPath.get(parsed.path);

      if (asset) {
        matched.push({
          ...asset,
          descriptor,
        });
      } else {
        // Asset referenced but not found in ZIP
        matched.push({
          path: parsed.path,
          descriptor,
          buffer: undefined,
        });
      }
    } else if (parsed.scheme === 'ccdefault') {
      // Default asset, no file needed
      matched.push({
        path: 'ccdefault:',
        descriptor,
        buffer: undefined,
      });
    } else if (parsed.scheme === 'https' || parsed.scheme === 'http') {
      // Remote asset, no file needed
      matched.push({
        path: descriptor.uri,
        descriptor,
        buffer: undefined,
      });
    } else if (parsed.scheme === 'data') {
      // Data URI, extract the data
      if (parsed.data && parsed.encoding === 'base64') {
        const buffer = base64Decode(parsed.data);
        matched.push({
          path: 'data:',
          descriptor,
          buffer,
        });
      } else {
        matched.push({
          path: 'data:',
          descriptor,
          buffer: undefined,
        });
      }
    }
  }

  return matched;
}

/**
 * Extract just the card.json from a CharX buffer (quick validation)
 */
export function readCardJsonOnly(data: BinaryData): CCv3Data {
  // Use streaming unzip with conservative limits for card.json extraction
  // This protects against zip bombs even for the "quick validation" path
  let unzipped: Unzipped;
  try {
    unzipped = streamingUnzipSync(data, {
      maxFileSize: DEFAULT_OPTIONS.maxFileSize, // 10MB for card.json
      maxTotalSize: DEFAULT_OPTIONS.maxTotalSize, // 200MB total
      maxFiles: 10000,
    });
  } catch (err) {
    throw new ParseError(
      `Failed to unzip CharX: ${err instanceof Error ? err.message : String(err)}`,
      'charx'
    );
  }

  const cardData = unzipped['card.json'];
  if (!cardData) {
    throw new ParseError('card.json not found in CharX file', 'charx');
  }

  try {
    const content = toString(cardData);
    return JSON.parse(content) as CCv3Data;
  } catch (err) {
    throw new ParseError(
      `Failed to parse card.json: ${err instanceof Error ? err.message : String(err)}`,
      'charx'
    );
  }
}

/**
 * Async version of readCharX with optional remote asset fetching
 */
export async function readCharXAsync(
  data: BinaryData,
  options: CharxReadOptions & { fetchRemoteAssets?: boolean; assetFetcher?: AssetFetcher } = {}
): Promise<CharxData> {
  // First do the sync extraction
  const result = readCharX(data, options);

  // If remote fetching is disabled or no fetcher provided, return as-is
  if (!options.fetchRemoteAssets || !options.assetFetcher) {
    return result;
  }

  // Fetch remote assets
  const fetchedAssets = await Promise.all(
    result.assets.map(async (asset) => {
      // Only fetch assets that don't have buffers and have remote URLs
      if (asset.buffer) {
        return asset;
      }

      const parsed = parseURI(asset.descriptor.uri);

      if ((parsed.scheme === 'https' || parsed.scheme === 'http') && parsed.url) {
        try {
          const buffer = await options.assetFetcher!(parsed.url);
          if (buffer) {
            return { ...asset, buffer };
          }
        } catch {
          // Failed to fetch, leave buffer undefined
        }
      }

      return asset;
    })
  );

  return {
    ...result,
    assets: fetchedAssets,
  };
}
