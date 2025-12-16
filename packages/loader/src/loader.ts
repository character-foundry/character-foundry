/**
 * Universal Card Loader
 *
 * Loads character cards from any supported format.
 */

import type { BinaryData } from '@character-foundry/core';
import { toString, ParseError, SizeLimitError, base64Decode, parseURI, getMimeTypeFromExt } from '@character-foundry/core';
import { detectSpec, type CCv3Data, type CCv2Data, type CCv2Wrapped, type Spec, type SourceFormat, type AssetDescriptor } from '@character-foundry/schemas';
import { extractFromPNG, removeAllTextChunks } from '@character-foundry/png';
import { readCharX } from '@character-foundry/charx';
import { readVoxta, voxtaToCCv3 } from '@character-foundry/voxta';
import { ccv2ToCCv3 } from '@character-foundry/normalizer';
import { parseLorebook as parseLorebookRaw, detectLorebookFormat } from '@character-foundry/lorebook';
import { detectFormat } from './detector.js';
import type {
  ParseResult,
  ParseOptions,
  ExtractedAsset,
  ContainerFormat,
  LorebookParseResult,
  CardParseResult,
  UniversalParseResult,
  LorebookFormat,
} from './types.js';

const DEFAULT_OPTIONS: Required<ParseOptions> = {
  maxFileSize: 50 * 1024 * 1024,
  maxAssetSize: 50 * 1024 * 1024,  // 50MB per Risu CharX spec
  maxTotalSize: 500 * 1024 * 1024,
  extractAssets: true,
};

/**
 * Estimate decoded size from base64 string length
 * Base64 encodes 3 bytes as 4 characters, so decoded is ~75% of encoded length
 */
function estimateBase64DecodedSize(base64Length: number): number {
  return Math.ceil(base64Length * 0.75);
}

/**
 * Detect file extension from magic numbers
 */
function detectExtension(buffer: Uint8Array): string | null {
  if (buffer.length < 4) return null;

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'jpg';
  }

  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return 'gif';
  }

  // WEBP: 52 49 46 46 ... 57 45 42 50 (RIFF ... WEBP)
  if (buffer.length >= 12 && 
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'webp';
  }

  // OGG: 4F 67 67 53
  if (buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
    return 'ogg';
  }

  // MP3: ID3 (49 44 33) or MPEG Sync Frame
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    return 'mp3';
  }
  // MPEG sync frame: More rigorous check to avoid false positives
  // Sync word: 11 bits of 1s (0xFFE or 0xFFF)
  // Check MPEG version (bits 19-20) and Layer (bits 17-18) are valid
  if (buffer.length >= 4 && buffer[0] === 0xFF && (buffer[1]! & 0xE0) === 0xE0) {
    const byte2 = buffer[1]!;
    const byte3 = buffer[2]!;
    // Check MPEG version: bits 19-20 should not be 0b01 (reserved)
    const version = (byte2 >> 3) & 0x03;
    // Check Layer: bits 17-18 should not be 0b00 (reserved)
    const layer = (byte2 >> 1) & 0x03;
    // Check bitrate index: bits 12-15 should not be 0b1111 (invalid)
    const bitrateIndex = (byte3 >> 4) & 0x0F;
    // Check sample rate: bits 10-11 should not be 0b11 (reserved)
    const sampleRate = (byte3 >> 2) & 0x03;

    if (version !== 0x01 && layer !== 0x00 && bitrateIndex !== 0x0F && sampleRate !== 0x03) {
      return 'mp3';
    }
  }

  // WAV: 52 49 46 46 ... 57 41 56 45 (RIFF ... WAVE)
  if (buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x41 && buffer[10] === 0x56 && buffer[11] === 0x45) {
    return 'wav';
  }

  return null;
}

/**
 * Parse a PNG character card
 */
function parsePng(data: BinaryData, options: Required<ParseOptions>): ParseResult {
  // Check file size limit
  if (data.length > options.maxFileSize) {
    throw new SizeLimitError(data.length, options.maxFileSize, 'PNG file');
  }

  const extracted = extractFromPNG(data);

  // Track warnings for non-fatal issues
  const warnings: string[] = [];

  // Convert to v3 if needed
  let card: CCv3Data;
  if (extracted.spec === 'v3') {
    card = extracted.data as CCv3Data;
  } else {
    card = ccv2ToCCv3(extracted.data as CCv2Data);
  }

  // Determine source format
  let sourceFormat: SourceFormat = extracted.spec === 'v3' ? 'png_v3' : 'png_v2';
  const extensions = card.data.extensions as Record<string, unknown> | undefined;
  if (extensions?.risuai) {
    sourceFormat = 'charx_risu'; // RisuAI card in PNG
  }

  // The PNG image itself is the main icon
  // Strip metadata (tEXt/zTXt chunks) for clean thumbnail/cross-format exports
  const strippedPng = removeAllTextChunks(data);

  const assets: ExtractedAsset[] = [{
    name: 'main',
    type: 'icon',
    ext: 'png',
    data: strippedPng,
    isMain: true,
  }];

  // Extract embedded assets (RisuAI style chunks)
  if (extracted.extraChunks && options.extractAssets && card.data.assets) {
    const usedChunks = new Set<string>();

    // PERFORMANCE: Build a Map for O(1) chunk lookups instead of O(n) per asset
    const chunkMap = new Map<string, { keyword: string; text: string }>();
    for (const chunk of extracted.extraChunks) {
      chunkMap.set(chunk.keyword, chunk);
      // Also index by suffix for chara-ext-asset_ variants
      if (chunk.keyword.startsWith('chara-ext-asset_')) {
        const suffix = chunk.keyword.replace('chara-ext-asset_', '');
        chunkMap.set(suffix, chunk);
        // Handle colon prefix variant
        if (suffix.startsWith(':')) {
          chunkMap.set(suffix.substring(1), chunk);
        }
      }
    }

    for (const descriptor of card.data.assets) {
      if (!descriptor.uri) continue;

      // Check if it's a chunk reference
      if (
        descriptor.uri.startsWith('__asset:') ||
        descriptor.uri.startsWith('asset:') ||
        descriptor.uri.startsWith('pngchunk:') ||
        !descriptor.uri.includes(':') // e.g. just "0"
      ) {
        let assetId = descriptor.uri;
        if (assetId.startsWith('__asset:')) assetId = assetId.substring(8);
        else if (assetId.startsWith('asset:')) assetId = assetId.substring(6);
        else if (assetId.startsWith('pngchunk:')) assetId = assetId.substring(9);

        // Try different key variations using O(1) Map lookups
        const candidates = [
          assetId,                        // "0"
          descriptor.uri,                 // "__asset:0"
          `asset:${assetId}`,             // "asset:0"
          `__asset:${assetId}`,           // "__asset:0"
          `__asset_${assetId}`,           // "__asset_0"
          `chara-ext-asset_${assetId}`,   // "chara-ext-asset_0"
          `chara-ext-asset_:${assetId}`,  // "chara-ext-asset_:0"
        ];

        // Find chunk using Map (O(1) per candidate instead of O(n))
        let chunk: { keyword: string; text: string } | undefined;
        for (const candidate of candidates) {
          chunk = chunkMap.get(candidate);
          if (chunk) break;
        }

        if (chunk) {
          try {
            // Check estimated size before decoding
            const estimatedSize = estimateBase64DecodedSize(chunk.text.length);
            if (estimatedSize > options.maxAssetSize) {
              throw new SizeLimitError(estimatedSize, options.maxAssetSize, `Asset chunk ${chunk.keyword}`);
            }

            const buffer = base64Decode(chunk.text);

            // Use descriptor metadata
            const type = mapAssetType(descriptor.type);
            
            // Try to determine extension
            let ext: string | undefined | null = descriptor.ext;
            if (!ext && descriptor.name) {
              const match = descriptor.name.match(/\.([^.]+)$/);
              if (match) ext = match[1];
            }
            if (!ext && descriptor.uri) {
               if (descriptor.uri.startsWith('data:')) {
                  const mime = descriptor.uri.match(/^data:([^;]+);/)?.[1];
                  if (mime) ext = mime.split('/')[1];
               } else {
                  const match = descriptor.uri.match(/\.([^.]+)$/);
                  if (match) ext = match[1];
               }
            }
            
            // Fallback to byte inspection
            if (!ext) {
              const detected = detectExtension(buffer);
              if (detected) ext = detected;
            }

            assets.push({
              name: descriptor.name,
              type,
              ext: ext || 'bin',
              data: buffer,
              path: `pngchunk:${assetId}`,
            });
            
            usedChunks.add(chunk.keyword);
          } catch (e) {
            // Track decode errors as warnings
            const msg = e instanceof Error ? e.message : String(e);
            warnings.push(`Failed to decode asset chunk ${chunk.keyword}: ${msg}`);
          }
        }
      }
    }

    // Add orphaned chunks (fallback)
    for (const chunk of extracted.extraChunks) {
      if (!usedChunks.has(chunk.keyword)) {
        let assetId: string | null = null;
        
        // Only process known asset chunk patterns to avoid junk
        if (chunk.keyword.startsWith('chara-ext-asset_:')) {
          assetId = chunk.keyword.substring('chara-ext-asset_:'.length);
        } else if (chunk.keyword.startsWith('chara-ext-asset_')) {
          assetId = chunk.keyword.substring('chara-ext-asset_'.length);
        }

        if (assetId) {
          try {
            // Check estimated size before decoding
            const estimatedSize = estimateBase64DecodedSize(chunk.text.length);
            if (estimatedSize > options.maxAssetSize) {
              throw new SizeLimitError(estimatedSize, options.maxAssetSize, `Orphan chunk ${chunk.keyword}`);
            }

            const buffer = base64Decode(chunk.text);

            // Infer extension from assetId if possible
            const extMatch = assetId.match(/\.([^.]+)$/);
            let ext = extMatch ? extMatch[1] : null;
            
            if (!ext) {
               const detected = detectExtension(buffer);
               if (detected) ext = detected;
            }

            assets.push({
              name: `asset_${assetId}`,
              type: 'data',
              ext: ext || 'bin',
              data: buffer,
              path: `pngchunk:${assetId}`,
            });
          } catch (e) {
            // Track decode errors as warnings
            const msg = e instanceof Error ? e.message : String(e);
            warnings.push(`Failed to decode orphan chunk ${chunk.keyword}: ${msg}`);
          }
        }
      }
    }
  }

  return {
    card,
    assets,
    containerFormat: 'png',
    spec: extracted.spec,
    sourceFormat,
    originalShape: extracted.data,
    rawJson: JSON.stringify(extracted.data),
    rawBuffer: data,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Parse a CharX archive
 */
function parseCharx(data: BinaryData, options: Required<ParseOptions>): ParseResult {
  const charxData = readCharX(data, {
    maxFileSize: options.maxFileSize,
    maxAssetSize: options.maxAssetSize,
    maxTotalSize: options.maxTotalSize,
  });

  const spec = detectSpec(charxData.card);

  // Convert assets from CharxAssetInfo to ExtractedAsset
  const assets: ExtractedAsset[] = charxData.assets
    .filter((asset) => asset.buffer !== undefined)
    .map((asset) => ({
      name: asset.descriptor.name,
      type: mapAssetType(asset.descriptor.type),
      ext: asset.descriptor.ext,
      data: asset.buffer!,
      path: asset.path,
      isMain: asset.descriptor.type === 'icon', // Main icon is type='icon' in descriptor
    }));

  // Determine source format
  const sourceFormat: SourceFormat = charxData.isRisuFormat ? 'charx_risu' : 'charx';

  return {
    card: charxData.card,
    assets,
    containerFormat: 'charx',
    spec: spec || 'v3',
    sourceFormat,
    originalShape: charxData.card,
    rawJson: JSON.stringify(charxData.card),
    rawBuffer: data,
    metadata: {
      dateCreated: undefined,
      dateModified: undefined,
      moduleRisum: charxData.moduleRisum,
    },
  };
}

/**
 * Map schema AssetType to loader ExtractedAsset type
 */
function mapAssetType(schemaType: string): ExtractedAsset['type'] {
  switch (schemaType) {
    case 'icon':
    case 'user_icon':
      return 'icon';
    case 'emotion':
      return 'emotion';
    case 'background':
      return 'background';
    case 'sound':
    case 'video':
      return 'sound';
    case 'custom':
    case 'x-risu-asset':
      return 'data';
    default:
      return 'unknown';
  }
}

/**
 * Parse a Voxta package
 */
function parseVoxta(data: BinaryData, options: Required<ParseOptions>): ParseResult {
  const voxtaData = readVoxta(data, {
    maxFileSize: options.maxFileSize,
    maxAssetSize: options.maxAssetSize,
    maxTotalSize: options.maxTotalSize,
  });

  if (voxtaData.characters.length === 0) {
    throw new ParseError('No characters found in Voxta package', 'voxta');
  }

  // Use first character
  const mainChar = voxtaData.characters[0]!;

  // Convert to CCv3
  const card = voxtaToCCv3(mainChar.data, voxtaData.books.map((b) => b.data));

  // Convert assets
  const assets: ExtractedAsset[] = [];

  // Add thumbnail if present
  if (mainChar.thumbnail) {
    assets.push({
      name: 'thumbnail',
      type: 'icon',
      ext: 'png',
      data: mainChar.thumbnail,
      isMain: true,
      characterId: mainChar.id,
    });
  }

  // Add other assets
  for (const asset of mainChar.assets || []) {
    const pathParts = asset.path.split('/');
    const fileName = pathParts[pathParts.length - 1] || 'asset';
    const extMatch = fileName.match(/\.([^.]+)$/);
    const ext = extMatch ? extMatch[1]! : 'bin';
    const name = fileName.replace(/\.[^.]+$/, '');

    let type: ExtractedAsset['type'] = 'unknown';
    if (asset.path.includes('VoiceSamples')) {
      type = 'sound';
    } else if (asset.path.includes('Avatars')) {
      type = 'emotion';
    }

    assets.push({
      name,
      type,
      ext,
      data: asset.buffer,
      path: asset.path,
      characterId: asset.characterId,
    });
  }

  return {
    card,
    assets,
    containerFormat: 'voxta',
    spec: 'v3',
    sourceFormat: 'voxta',
    originalShape: mainChar.data,
    rawBuffer: data,
    metadata: {
      characterId: mainChar.id,
      packageId: voxtaData.package?.Id,
      dateCreated: mainChar.data.DateCreated,
      dateModified: mainChar.data.DateModified,
    },
  };
}

/**
 * Parse raw JSON data
 */
function parseJson(data: BinaryData, options: Required<ParseOptions>): ParseResult {
  // SECURITY: Check size limit before parsing to prevent DoS via large JSON
  if (data.length > options.maxFileSize) {
    throw new SizeLimitError(data.length, options.maxFileSize, 'JSON file');
  }

  let jsonStr: string;
  try {
    jsonStr = toString(data);
  } catch (err) {
    throw new ParseError(
      `Failed to decode JSON: ${err instanceof Error ? err.message : String(err)}`,
      'json'
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new ParseError(
      `Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`,
      'json'
    );
  }

  return parseJsonFromParsed(parsed, jsonStr, data, options);
}

/**
 * Parse from already-parsed JSON data (avoids double parsing)
 */
function parseJsonFromParsed(
  parsed: unknown,
  jsonStr: string,
  rawBuffer: BinaryData,
  options: Required<ParseOptions>
): ParseResult {
  const spec = detectSpec(parsed);
  let card: CCv3Data;
  let sourceFormat: SourceFormat;

  if (spec === 'v3') {
    card = parsed as CCv3Data;
    sourceFormat = 'json_v3';
  } else if (spec === 'v2') {
    card = ccv2ToCCv3(parsed as CCv2Data);
    sourceFormat = 'json_v2';
  } else {
    throw new ParseError('JSON does not appear to be a valid character card', 'json');
  }

  // Check for RisuAI extensions
  const extensions = card.data.extensions as Record<string, unknown> | undefined;
  if (extensions?.risuai) {
    sourceFormat = 'charx_risu';
  }

  return {
    card,
    assets: [],
    containerFormat: 'json',
    spec: spec || 'v3',
    sourceFormat,
    originalShape: parsed,
    rawJson: jsonStr,
    rawBuffer,
  };
}

/**
 * Parse a character card from any supported format
 *
 * @param data - Binary data of the card file
 * @param options - Parsing options
 * @returns ParseResult with normalized card and extracted assets
 */
export function parseCard(data: BinaryData, options: ParseOptions = {}): ParseResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Detect format
  const detection = detectFormat(data);

  switch (detection.format) {
    case 'png':
      return parsePng(data, opts);

    case 'charx':
      return parseCharx(data, opts);

    case 'voxta':
      return parseVoxta(data, opts);

    case 'json':
      return parseJson(data, opts);

    case 'unknown':
    default:
      throw new ParseError(
        `Unrecognized format: ${detection.reason}`,
        'unknown'
      );
  }
}

/**
 * Async version of parseCard
 */
export async function parseCardAsync(
  data: BinaryData,
  options: ParseOptions = {}
): Promise<ParseResult> {
  return parseCard(data, options);
}

/**
 * Get the container format of data without fully parsing
 */
export function getContainerFormat(data: BinaryData): ContainerFormat {
  return detectFormat(data).format;
}

/** Default max lorebook size (10MB - lorebooks are typically small) */
const DEFAULT_MAX_LOREBOOK_SIZE = 10 * 1024 * 1024;

/**
 * Parse a standalone lorebook from JSON data
 */
function parseLorebookData(data: BinaryData, maxSize: number = DEFAULT_MAX_LOREBOOK_SIZE): LorebookParseResult {
  // SECURITY: Check size limit before parsing to prevent DoS via large JSON
  if (data.length > maxSize) {
    throw new SizeLimitError(data.length, maxSize, 'Lorebook file');
  }

  let jsonStr: string;
  try {
    jsonStr = toString(data);
  } catch (err) {
    throw new ParseError(
      `Failed to decode JSON: ${err instanceof Error ? err.message : String(err)}`,
      'lorebook'
    );
  }

  try {
    const result = parseLorebookRaw(data);
    return {
      type: 'lorebook',
      book: result.book,
      containerFormat: 'lorebook',
      lorebookFormat: result.originalFormat as LorebookFormat,
      originalShape: result.originalShape,
      rawJson: jsonStr,
      rawBuffer: data,
    };
  } catch (err) {
    throw new ParseError(
      `Failed to parse lorebook: ${err instanceof Error ? err.message : String(err)}`,
      'lorebook'
    );
  }
}

/**
 * Check if JSON data looks like a lorebook (not a character card)
 */
function isLorebookJson(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;

  // Quick check: if it has spec or spec_version, it's a character card
  if (obj.spec || obj.spec_version) return false;

  // Quick check: if it has data.name or data.description (CCv3 card structure), it's a card
  if (obj.data && typeof obj.data === 'object') {
    const dataObj = obj.data as Record<string, unknown>;
    if (dataObj.name || dataObj.description) return false;
  }

  // Check for lorebook indicators
  const format = detectLorebookFormat(data);
  return format !== 'unknown';
}

/**
 * Parse a standalone lorebook file
 *
 * @param data - Binary data of the lorebook file
 * @returns LorebookParseResult with normalized lorebook
 */
export function parseLorebook(data: BinaryData): LorebookParseResult {
  return parseLorebookData(data);
}

/**
 * Async version of parseLorebook
 */
export async function parseLorebookAsync(data: BinaryData): Promise<LorebookParseResult> {
  return parseLorebook(data);
}

/**
 * Universal parser that handles both character cards and standalone lorebooks.
 *
 * Returns a discriminated union - check result.type to narrow:
 * - 'card': CardParseResult with card data
 * - 'lorebook': LorebookParseResult with lorebook data
 *
 * @param data - Binary data of the file
 * @param options - Parsing options
 * @returns UniversalParseResult (CardParseResult | LorebookParseResult)
 *
 * @example
 * ```ts
 * const result = parse(buffer);
 * if (result.type === 'card') {
 *   console.log(result.card.data.name);
 * } else {
 *   console.log(result.book.name, result.book.entries.length);
 * }
 * ```
 */
export function parse(data: BinaryData, options: ParseOptions = {}): UniversalParseResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const detection = detectFormat(data);

  // For non-JSON formats, parse as card
  if (detection.format !== 'json' && detection.format !== 'unknown') {
    const result = parseCard(data, opts);
    return { ...result, type: 'card' } as CardParseResult;
  }

  // For JSON, we need to determine if it's a card or lorebook
  if (detection.format === 'json') {
    let jsonStr: string;
    let parsed: unknown;

    try {
      jsonStr = toString(data);
      parsed = JSON.parse(jsonStr);
    } catch (err) {
      throw new ParseError(
        `Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`,
        'json'
      );
    }

    // Check if it's a lorebook first (more specific check)
    if (isLorebookJson(parsed)) {
      return parseLorebookData(data, opts.maxFileSize);
    }

    // Otherwise try to parse as card
    const spec = detectSpec(parsed);
    if (spec) {
      // PERFORMANCE: Pass already-parsed data to avoid re-parsing
      const result = parseJsonFromParsed(parsed, jsonStr, data, opts);
      return { ...result, type: 'card' } as CardParseResult;
    }

    // Neither card nor lorebook - could still be unknown lorebook format
    // Try lorebook as fallback
    try {
      return parseLorebookData(data, opts.maxFileSize);
    } catch {
      throw new ParseError('JSON does not appear to be a valid character card or lorebook', 'json');
    }
  }

  throw new ParseError(
    `Unrecognized format: ${detection.reason}`,
    'unknown'
  );
}

/**
 * Async version of parse
 */
export async function parseAsync(
  data: BinaryData,
  options: ParseOptions = {}
): Promise<UniversalParseResult> {
  return parse(data, options);
}