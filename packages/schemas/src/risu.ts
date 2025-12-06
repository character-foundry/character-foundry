/**
 * RisuAI Extension Types
 *
 * These extensions are preserved as opaque blobs.
 * We do NOT interpret or transform the script contents.
 */

/**
 * Risu emotions mapping (v2 style)
 * Format: [name, uri][]
 */
export type RisuEmotions = [string, string][];

/**
 * Risu additional assets (v3 style)
 * Format: [name, uri, type][]
 */
export type RisuAdditionalAssets = [string, string, string][];

/**
 * Risu depth prompt configuration
 */
export interface RisuDepthPrompt {
  depth: number;
  prompt: string;
}

/**
 * Risu extensions in card.extensions.risuai
 * Preserved as opaque - we don't interpret script contents
 */
export interface RisuExtensions {
  // Emotion assets
  emotions?: RisuEmotions;
  additionalAssets?: RisuAdditionalAssets;

  // Script data - OPAQUE, do not parse
  triggerscript?: unknown;
  customScripts?: unknown;

  // Voice/TTS settings
  vits?: Record<string, string>;

  // Depth prompt
  depth_prompt?: RisuDepthPrompt;

  // Other Risu-specific fields
  [key: string]: unknown;
}

/**
 * CharX x_meta entry (PNG chunk metadata preservation)
 */
export interface CharxMetaEntry {
  type?: string;  // e.g., 'WEBP', 'PNG', 'JPEG'
  [key: string]: unknown;
}

/**
 * Check if card has Risu extensions
 */
export function hasRisuExtensions(extensions?: Record<string, unknown>): boolean {
  if (!extensions) return false;
  return 'risuai' in extensions || 'risu' in extensions;
}

/**
 * Check if card has Risu scripts (triggerscript or customScripts)
 */
export function hasRisuScripts(extensions?: Record<string, unknown>): boolean {
  if (!extensions) return false;
  const risu = extensions.risuai as RisuExtensions | undefined;
  if (!risu) return false;
  return !!risu.triggerscript || !!risu.customScripts;
}

/**
 * Check if card has depth prompt
 * Checks both SillyTavern style (extensions.depth_prompt) and Risu style (extensions.risuai.depth_prompt)
 */
export function hasDepthPrompt(extensions?: Record<string, unknown>): boolean {
  if (!extensions) return false;
  // SillyTavern top-level depth_prompt
  if ('depth_prompt' in extensions && extensions.depth_prompt) return true;
  // Risu-style depth_prompt
  const risu = extensions.risuai as RisuExtensions | undefined;
  return !!risu?.depth_prompt;
}
