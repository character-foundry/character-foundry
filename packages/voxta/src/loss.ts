/**
 * Voxta Loss Reporting
 *
 * Documents what data is lost when exporting to Voxta format.
 */

import type { NormalizedCard } from '@character-foundry/schemas';
import { hasRisuExtensions, hasRisuScripts, hasDepthPrompt } from '@character-foundry/schemas';
import type { VoxtaLossReport } from './types.js';

/**
 * Fields that cannot be represented in Voxta format
 */
const ALWAYS_LOST_FIELDS = [
  'group_only_greetings',    // Voxta doesn't support groups
];

/**
 * Extension namespaces that are always lost
 */
const LOST_EXTENSION_NAMESPACES = [
  'risuai',                  // All Risu extensions
  'chub',                    // Chub metadata
  'depth_prompt',            // SillyTavern depth prompts
];

/**
 * Check what would be lost when exporting a card to Voxta format
 */
export function checkVoxtaLoss(card: NormalizedCard): VoxtaLossReport {
  const lostFields: string[] = [];
  const lostAssets: string[] = [];
  const warnings: string[] = [];

  // Check always-lost fields that have content
  // Note: system_prompt, post_history_instructions, and alternate_greetings ARE supported by Voxta
  if (card.groupOnlyGreetings.length > 0) {
    lostFields.push(`group_only_greetings (${card.groupOnlyGreetings.length} entries)`);
  }

  // Check extensions
  const extensions = card.extensions;

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

  // Check for any other unknown extensions
  for (const key of Object.keys(extensions)) {
    if (key !== 'voxta' && key !== 'visual_description' && !LOST_EXTENSION_NAMESPACES.includes(key)) {
      lostFields.push(`extensions.${key}`);
    }
  }

  // Check character book extensions
  if (card.characterBook?.extensions) {
    lostFields.push('character_book.extensions');
  }

  // Check lorebook entry extensions
  if (card.characterBook?.entries) {
    const entriesWithExtensions = card.characterBook.entries.filter(e => e.extensions && Object.keys(e.extensions).length > 0);
    if (entriesWithExtensions.length > 0) {
      lostFields.push(`lorebook entries extensions (${entriesWithExtensions.length} entries)`);
    }
  }

  return {
    lostFields,
    lostAssets,
    warnings,
    reason: 'Voxta format does not support extensions field',
  };
}

/**
 * Check if export would be lossless
 */
export function isVoxtaExportLossless(card: NormalizedCard): boolean {
  const report = checkVoxtaLoss(card);
  return report.lostFields.length === 0 && report.lostAssets.length === 0;
}

/**
 * Format loss report as human-readable string
 */
export function formatVoxtaLossReport(report: VoxtaLossReport): string {
  const lines: string[] = [];

  if (report.lostFields.length === 0 && report.lostAssets.length === 0 && report.warnings.length === 0) {
    return 'No data will be lost in this export.';
  }

  lines.push('Voxta Export Loss Report');
  lines.push('========================');
  lines.push('');
  lines.push(`Reason: ${report.reason}`);
  lines.push('');

  if (report.lostFields.length > 0) {
    lines.push('Lost Fields:');
    for (const field of report.lostFields) {
      lines.push(`  - ${field}`);
    }
    lines.push('');
  }

  if (report.lostAssets.length > 0) {
    lines.push('Lost Assets:');
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
