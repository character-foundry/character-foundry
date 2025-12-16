/**
 * Feature Derivation
 *
 * Canonical feature extraction from character cards.
 * Eliminates duplicate implementations across Archive, Federation, and Architect.
 */

import type { CCv2Data } from './ccv2.js';
import type { CCv3DataInner } from './ccv3.js';
import type { DerivedFeatures } from './normalized.js';
import { hasRisuExtensions, hasRisuScripts, hasDepthPrompt } from './risu.js';

/**
 * Derive features from a character card (V2 or V3 format).
 *
 * This is the canonical implementation - all apps should use this
 * rather than implementing their own feature detection.
 *
 * @param card - Either CCv2Data or CCv3DataInner (unwrapped)
 * @returns DerivedFeatures with all feature flags populated
 *
 * @example
 * ```typescript
 * import { deriveFeatures, parseV3Card } from '@character-foundry/schemas';
 *
 * const card = parseV3Card(data);
 * const features = deriveFeatures(card.data);
 *
 * if (features.hasLorebook) {
 *   console.log(`Found ${features.lorebookEntriesCount} lorebook entries`);
 * }
 * ```
 */
export function deriveFeatures(card: CCv2Data | CCv3DataInner): DerivedFeatures {
  // Detect format by checking for V3-specific field
  const isV3 = 'assets' in card;

  // Alternate greetings
  const altGreetings = card.alternate_greetings ?? [];
  const hasAlternateGreetings = altGreetings.length > 0;
  const alternateGreetingsCount = altGreetings.length;
  // Total = first_mes (1) + alternate_greetings
  const totalGreetingsCount = 1 + alternateGreetingsCount;

  // Lorebook
  const characterBook = card.character_book;
  const hasLorebook = !!characterBook && characterBook.entries.length > 0;
  const lorebookEntriesCount = characterBook?.entries.length ?? 0;

  // Assets (V3 only) - check for visual asset types
  const assets = isV3 ? (card as CCv3DataInner).assets ?? [] : [];
  const imageAssetTypes = ['icon', 'background', 'emotion', 'custom'];
  const imageAssets = assets.filter(
    (a) =>
      imageAssetTypes.includes(a.type) ||
      ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(a.ext.toLowerCase()),
  );
  const hasGallery = imageAssets.length > 0;

  // Embedded images - check for data URLs in text fields
  const embeddedImageCount = countEmbeddedImages(card);
  const hasEmbeddedImages = embeddedImageCount > 0;

  // Extensions
  const extensions = card.extensions ?? {};
  const hasRisu = hasRisuExtensions(extensions);
  const hasScripts = hasRisuScripts(extensions);
  const hasDepth = hasDepthPrompt(extensions);
  const hasVoxta = checkVoxtaAppearance(extensions);

  // Token counts - initialize to zero (actual counting happens in tokenizers package)
  const tokens = {
    description: 0,
    personality: 0,
    scenario: 0,
    firstMes: 0,
    mesExample: 0,
    systemPrompt: 0,
    total: 0,
  };

  return {
    hasAlternateGreetings,
    alternateGreetingsCount,
    totalGreetingsCount,
    hasLorebook,
    lorebookEntriesCount,
    hasEmbeddedImages,
    embeddedImagesCount: embeddedImageCount,
    hasGallery,
    hasRisuExtensions: hasRisu,
    hasRisuScripts: hasScripts,
    hasDepthPrompt: hasDepth,
    hasVoxtaAppearance: hasVoxta,
    tokens,
  };
}

/**
 * Count embedded images (data URLs) in card text fields.
 * Looks for base64-encoded images in description, personality, scenario, etc.
 */
function countEmbeddedImages(card: CCv2Data | CCv3DataInner): number {
  const textFields = [
    card.description,
    card.personality,
    card.scenario,
    card.first_mes,
    card.mes_example,
    card.creator_notes,
    card.system_prompt,
    card.post_history_instructions,
    ...(card.alternate_greetings ?? []),
  ].filter((field): field is string => typeof field === 'string');

  // Add group_only_greetings if V3
  if ('group_only_greetings' in card) {
    textFields.push(...(card.group_only_greetings ?? []));
  }

  let count = 0;
  const dataUrlPattern = /data:image\/[^;]+;base64,/g;

  for (const text of textFields) {
    const matches = text.match(dataUrlPattern);
    if (matches) {
      count += matches.length;
    }
  }

  return count;
}

/**
 * Check if card has Voxta appearance data.
 * Voxta stores appearance in extensions.voxta.appearance
 */
function checkVoxtaAppearance(extensions: Record<string, unknown>): boolean {
  if (!extensions.voxta) return false;
  const voxta = extensions.voxta as Record<string, unknown>;
  return !!voxta.appearance;
}
