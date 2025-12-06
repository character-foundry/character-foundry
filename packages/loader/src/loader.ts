/**
 * Universal Card Loader
 *
 * Loads character cards from any supported format.
 */

import type { BinaryData } from '@character-foundry/core';
import { toString, ParseError, base64Decode } from '@character-foundry/core';
import { detectSpec, getV2Data, type CCv3Data, type CCv2Data, type CCv2Wrapped, type Spec, type SourceFormat } from '@character-foundry/schemas';
import { extractFromPNG } from '@character-foundry/png';
import { readCharX } from '@character-foundry/charx';
import { readVoxta, voxtaToCCv3 } from '@character-foundry/voxta';
import { detectFormat } from './detector.js';
import type {
  ParseResult,
  ParseOptions,
  ExtractedAsset,
  ContainerFormat,
} from './types.js';

const DEFAULT_OPTIONS: Required<ParseOptions> = {
  maxFileSize: 50 * 1024 * 1024,
  maxAssetSize: 50 * 1024 * 1024,
  maxTotalSize: 500 * 1024 * 1024,
  extractAssets: true,
  normalize: true,
};

/**
 * Convert v2 data to v3 format
 */
function v2ToV3(v2: CCv2Data | CCv2Wrapped): CCv3Data {
  const data = getV2Data(v2);
  return {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: data.name || 'Unknown',
      description: data.description || '',
      personality: data.personality || '',
      scenario: data.scenario || '',
      first_mes: data.first_mes || '',
      mes_example: data.mes_example || '',
      creator_notes: data.creator_notes || '',
      system_prompt: data.system_prompt || '',
      post_history_instructions: data.post_history_instructions || '',
      alternate_greetings: data.alternate_greetings || [],
      group_only_greetings: (data as unknown as Record<string, unknown>).group_only_greetings as string[] || [],
      tags: data.tags || [],
      creator: data.creator || '',
      character_version: data.character_version || '',
      character_book: data.character_book,
      extensions: data.extensions || {},
    },
  };
}

/**
 * Parse a PNG character card
 */
function parsePng(data: BinaryData, options: Required<ParseOptions>): ParseResult {
  const extracted = extractFromPNG(data);

  // Convert to v3 if needed
  let card: CCv3Data;
  if (extracted.spec === 'v3') {
    card = extracted.data as CCv3Data;
  } else {
    card = v2ToV3(extracted.data as CCv2Data);
  }

  // Determine source format
  let sourceFormat: SourceFormat = extracted.spec === 'v3' ? 'png_v3' : 'png_v2';
  const extensions = card.data.extensions as Record<string, unknown> | undefined;
  if (extensions?.risuai) {
    sourceFormat = 'charx_risu'; // RisuAI card in PNG
  }

  // The PNG image itself is the main icon
  const assets: ExtractedAsset[] = [{
    name: 'main',
    type: 'icon',
    ext: 'png',
    data: data,
    isMain: true,
  }];

  // Extract embedded assets (RisuAI style chunks)
  if (extracted.extraChunks && options.extractAssets) {
    for (const chunk of extracted.extraChunks) {
      let assetId: string | null = null;

      // Check for RisuAI format: chara-ext-asset_:N
      if (chunk.keyword.startsWith('chara-ext-asset_:')) {
        assetId = chunk.keyword.substring('chara-ext-asset_:'.length);
      }
      // Check for variant: chara-ext-asset_N
      else if (chunk.keyword.startsWith('chara-ext-asset_')) {
        assetId = chunk.keyword.substring('chara-ext-asset_'.length);
      }
      // Check for legacy numeric only
      else if (/^\d+$/.test(chunk.keyword)) {
        assetId = chunk.keyword;
      }

      if (assetId !== null) {
        try {
          const buffer = base64Decode(chunk.text);
          assets.push({
            name: `asset_${assetId}`,
            type: 'data',
            ext: 'bin', // Unknown type, consumer must sniff
            data: buffer,
            path: `pngchunk:${assetId}`, // Normalized URI format for PNG chunks
          });
        } catch {
          // Ignore failed decodes
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
      isMain: asset.path.includes('/main.') || asset.path.endsWith('/1.'),
    }));

  // Determine source format
  let sourceFormat: SourceFormat = charxData.isRisuFormat ? 'charx_risu' : 'charx';

  return {
    card: charxData.card,
    assets,
    containerFormat: 'charx',
    spec: spec || 'v3',
    sourceFormat,
    originalShape: charxData.card,
    rawJson: JSON.stringify(charxData.card),
    rawBuffer: data,
    metadata: charxData.metadata ? {
      dateCreated: undefined,
      dateModified: undefined,
    } : undefined,
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

  const spec = detectSpec(parsed);
  let card: CCv3Data;
  let sourceFormat: SourceFormat;

  if (spec === 'v3') {
    card = parsed as CCv3Data;
    sourceFormat = 'json_v3';
  } else if (spec === 'v2') {
    card = v2ToV3(parsed as CCv2Data);
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
    rawBuffer: data,
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
