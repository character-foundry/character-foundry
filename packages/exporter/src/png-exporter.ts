/**
 * PNG Exporter
 *
 * Exports character cards to PNG format with embedded JSON.
 */

import type { CCv3Data, CCv2Data } from '@character-foundry/schemas';
import { 
  embedIntoPNG, 
  injectTextChunk, 
  removeAllTextChunks 
} from '@character-foundry/png';
import { base64Encode, fromString } from '@character-foundry/core';
import type { ExportAsset, PngExportOptions, ExportResult } from './types.js';
import { checkExportLoss } from './loss-checker.js';

/**
 * Convert CCv3 to CCv2 data format for compatibility
 */
function convertToV2Data(card: CCv3Data): CCv2Data {
  const data = card.data;

  // Convert character book entries to ensure extensions is not undefined
  const characterBook = data.character_book ? {
    ...data.character_book,
    entries: data.character_book.entries.map((entry) => ({
      ...entry,
      extensions: entry.extensions || {},
    })),
  } : undefined;

  return {
    name: data.name,
    description: data.description,
    personality: data.personality,
    scenario: data.scenario,
    first_mes: data.first_mes,
    mes_example: data.mes_example,
    creator_notes: data.creator_notes,
    system_prompt: data.system_prompt,
    post_history_instructions: data.post_history_instructions,
    alternate_greetings: data.alternate_greetings,
    character_book: characterBook,
    tags: data.tags,
    creator: data.creator,
    character_version: data.character_version,
    extensions: data.extensions,
  };
}

/**
 * Sanitize filename for safe filesystem use
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 100) || 'character';
}

/**
 * Export card to PNG format
 */
export function exportToPng(
  card: CCv3Data,
  assets: ExportAsset[],
  options: PngExportOptions = {}
): ExportResult {
  const {
    chunkKey = 'chara',
    exportAsV2 = false,
    checkLoss = true,
  } = options;

  // Find main icon asset
  const mainIcon = assets.find((a) => a.isMain && a.type === 'icon') ||
                   assets.find((a) => a.type === 'icon');

  if (!mainIcon) {
    throw new Error('PNG export requires at least one icon asset');
  }

  // Prepare card data
  let cardData: CCv2Data | CCv3Data;

  if (exportAsV2) {
    // Export as v2 format for maximum compatibility
    cardData = convertToV2Data(card);
  } else {
    // Export as v3
    cardData = card;
  }

  // 1. Clean the PNG (remove existing chunks)
  let currentPng = removeAllTextChunks(mainIcon.data);

  // 2. Embed the main card data
  const json = JSON.stringify(cardData); // Minified by default
  const text = base64Encode(fromString(json));
  currentPng = injectTextChunk(currentPng, chunkKey, text);

  // 3. Embed RisuAI extra assets
  for (const asset of assets) {
    if (asset.path && asset.path.startsWith('pngchunk:')) {
      // Extract ID from "pngchunk:N"
      const id = asset.path.substring('pngchunk:'.length);
      
      // Encode asset data
      const assetBase64 = base64Encode(asset.data);
      
      // Inject chunk "chara-ext-asset_:N"
      currentPng = injectTextChunk(currentPng, `chara-ext-asset_:${id}`, assetBase64);
    }
  }

  // Generate loss report if requested
  const lossReport = checkLoss ? checkExportLoss(card, assets, 'png') : undefined;

  const filename = `${sanitizeFilename(card.data.name)}.png`;

  return {
    buffer: currentPng,
    format: 'png',
    filename,
    mimeType: 'image/png',
    assetCount: 1,
    totalSize: currentPng.length,
    lossReport,
  };
}

/**
 * Async version of exportToPng
 */
export async function exportToPngAsync(
  card: CCv3Data,
  assets: ExportAsset[],
  options: PngExportOptions = {}
): Promise<ExportResult> {
  return exportToPng(card, assets, options);
}
