/**
 * Export Loss Checker
 *
 * Analyzes what data would be lost when exporting to different formats.
 */

import type { CCv3Data } from '@character-foundry/schemas';
import { hasRisuExtensions, hasRisuScripts, hasDepthPrompt } from '@character-foundry/schemas';
import { FormatNotSupportedError } from '@character-foundry/core';
import type { ExportFormat, ExportLossReport, ExportAsset, PreExportCheck } from './types.js';

/**
 * Check loss for PNG export
 */
function checkPngLoss(card: CCv3Data, assets: ExportAsset[]): ExportLossReport {
  const lostFields: string[] = [];
  const lostAssets: string[] = [];
  const warnings: string[] = [];

  // PNG can only embed one image (the main icon)
  const nonMainAssets = assets.filter((a) => !a.isMain && a.type !== 'icon');
  if (nonMainAssets.length > 0) {
    for (const asset of nonMainAssets) {
      lostAssets.push(`${asset.name}.${asset.ext} (${asset.type})`);
    }
    warnings.push(`${nonMainAssets.length} assets cannot be embedded in PNG format`);
  }

  // Additional emotion assets beyond main
  const emotionAssets = assets.filter((a) => a.type === 'emotion');
  if (emotionAssets.length > 1) {
    warnings.push('Multiple emotion assets - only main icon will be embedded');
  }

  // Sound assets cannot be embedded in PNG
  const soundAssets = assets.filter((a) => a.type === 'sound');
  if (soundAssets.length > 0) {
    warnings.push(`${soundAssets.length} sound assets cannot be embedded in PNG`);
  }

  // Check for embedded asset URIs that won't resolve
  const _extensions = card.data.extensions as Record<string, unknown> | undefined;
  if (card.data.assets && card.data.assets.length > 1) {
    warnings.push('Card has multiple asset references - only main will be available');
  }

  return {
    lostFields,
    lostAssets,
    warnings,
    targetFormat: 'png',
    isLossless: lostFields.length === 0 && lostAssets.length === 0,
  };
}

/**
 * Check loss for CharX export
 */
function checkCharxLoss(card: CCv3Data, _assets: ExportAsset[]): ExportLossReport {
  const lostFields: string[] = [];
  const lostAssets: string[] = [];
  const warnings: string[] = [];

  // CharX supports most CCv3 features, minimal loss expected
  const extensions = card.data.extensions as Record<string, unknown> | undefined;

  // Voxta-specific extensions won't be preserved in standard CharX
  if (extensions?.voxta) {
    warnings.push('Voxta-specific settings may not be recognized by all applications');
  }

  // Check for remote asset URLs that might not be fetched
  if (card.data.assets) {
    for (const asset of card.data.assets) {
      if (asset.uri.startsWith('http://') || asset.uri.startsWith('https://')) {
        warnings.push(`Remote asset URL may not be resolved: ${asset.uri}`);
      }
    }
  }

  return {
    lostFields,
    lostAssets,
    warnings,
    targetFormat: 'charx',
    isLossless: lostFields.length === 0 && lostAssets.length === 0,
  };
}

/**
 * Check loss for Voxta export
 */
function checkVoxtaLoss(card: CCv3Data, assets: ExportAsset[]): ExportLossReport {
  const lostFields: string[] = [];
  const lostAssets: string[] = [];
  const warnings: string[] = [];

  const cardData = card.data;
  const extensions = cardData.extensions as Record<string, unknown> | undefined;

  // Note: Voxta DOES support system_prompt (as SystemPrompt)
  // Note: Voxta DOES support post_history_instructions (as PostHistoryInstructions)
  // Note: Voxta DOES support alternate_greetings (as AlternativeFirstMessages)

  // Voxta doesn't support group greetings
  if (cardData.group_only_greetings && cardData.group_only_greetings.length > 0) {
    lostFields.push(`group_only_greetings (${cardData.group_only_greetings.length} entries)`);
  }

  // Check extensions
  if (hasRisuExtensions(extensions)) {
    lostFields.push('extensions.risuai.*');
    if (hasRisuScripts(extensions)) {
      warnings.push('Risu scripts (triggerscript, customScripts) will be lost');
    }
  }

  if (hasDepthPrompt(extensions)) {
    lostFields.push('extensions.depth_prompt');
    warnings.push('SillyTavern depth prompt will be lost');
  }

  if (extensions?.chub) {
    lostFields.push('extensions.chub.*');
  }

  // Check for unknown extensions
  if (extensions) {
    for (const key of Object.keys(extensions)) {
      if (key !== 'voxta' && key !== 'visual_description' &&
          key !== 'risuai' && key !== 'chub' && key !== 'depth_prompt') {
        lostFields.push(`extensions.${key}`);
      }
    }
  }

  // Character book extensions
  if (cardData.character_book?.extensions) {
    lostFields.push('character_book.extensions');
  }

  // Lorebook entry extensions
  if (cardData.character_book?.entries) {
    const entriesWithExt = cardData.character_book.entries.filter(
      (e) => e.extensions && Object.keys(e.extensions).length > 0
    );
    if (entriesWithExt.length > 0) {
      lostFields.push(`lorebook entries extensions (${entriesWithExt.length} entries)`);
    }
  }

  // Asset checks
  const unsupportedAssets = assets.filter(
    (a) => a.type !== 'icon' && a.type !== 'emotion' && a.type !== 'sound'
  );
  for (const asset of unsupportedAssets) {
    lostAssets.push(`${asset.name}.${asset.ext} (${asset.type})`);
  }

  return {
    lostFields,
    lostAssets,
    warnings,
    targetFormat: 'voxta',
    isLossless: lostFields.length === 0 && lostAssets.length === 0,
  };
}

/**
 * Check what would be lost when exporting to a specific format
 */
export function checkExportLoss(
  card: CCv3Data,
  assets: ExportAsset[],
  targetFormat: ExportFormat
): ExportLossReport {
  switch (targetFormat) {
    case 'png':
      return checkPngLoss(card, assets);
    case 'charx':
      return checkCharxLoss(card, assets);
    case 'voxta':
      return checkVoxtaLoss(card, assets);
    default:
      throw new FormatNotSupportedError(targetFormat);
  }
}

/**
 * Perform pre-export check and suggest alternatives
 */
export function preExportCheck(
  card: CCv3Data,
  assets: ExportAsset[],
  targetFormat: ExportFormat
): PreExportCheck {
  const lossReport = checkExportLoss(card, assets, targetFormat);

  // Suggest alternatives if significant loss
  const suggestedFormats: ExportFormat[] = [];

  if (!lossReport.isLossless) {
    // Check other formats for less loss
    const allFormats: ExportFormat[] = ['png', 'charx', 'voxta'];

    for (const format of allFormats) {
      if (format === targetFormat) continue;
      const altReport = checkExportLoss(card, assets, format);
      if (altReport.lostFields.length < lossReport.lostFields.length) {
        suggestedFormats.push(format);
      }
    }
  }

  return {
    canExport: true, // Always allow export, just warn about loss
    lossReport,
    suggestedFormats: suggestedFormats.length > 0 ? suggestedFormats : undefined,
  };
}

/**
 * Format a loss report as human-readable string
 */
export function formatLossReport(report: ExportLossReport): string {
  const lines: string[] = [];

  if (report.isLossless) {
    return `Export to ${report.targetFormat.toUpperCase()} will be lossless.`;
  }

  lines.push(`Export Loss Report (${report.targetFormat.toUpperCase()})`);
  lines.push('='.repeat(40));
  lines.push('');

  if (report.lostFields.length > 0) {
    lines.push('Fields that will be lost:');
    for (const field of report.lostFields) {
      lines.push(`  - ${field}`);
    }
    lines.push('');
  }

  if (report.lostAssets.length > 0) {
    lines.push('Assets that will be lost:');
    for (const asset of report.lostAssets) {
      lines.push(`  - ${asset}`);
    }
    lines.push('');
  }

  if (report.warnings.length > 0) {
    lines.push('Warnings:');
    for (const warning of report.warnings) {
      lines.push(`  ! ${warning}`);
    }
  }

  return lines.join('\n');
}
