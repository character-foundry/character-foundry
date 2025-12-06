/**
 * Voxta Asset Enricher
 *
 * Analyzes Voxta asset paths to extract semantic tags and types.
 * e.g. "Avatars/Default/happy_idle_01.webp" -> tags: [emotion:happy, state:idle, variant:01]
 */

import type { ExtractedVoxtaAsset } from './types.js';

export interface EnrichedAssetMetadata {
  type: 'icon' | 'sound' | 'custom';
  tags: string[];
}

/**
 * Extract metadata from a Voxta asset path/filename
 */
export function enrichVoxtaAsset(asset: ExtractedVoxtaAsset): EnrichedAssetMetadata {
  const tags: string[] = [];
  let type: EnrichedAssetMetadata['type'] = 'custom';

  const parts = asset.path.split('/');
  const filename = parts[parts.length - 1] || '';
  
  // 1. Determine Type
  if (asset.path.includes('/Avatars/')) {
    type = 'icon';
    
    // 2. Extract Semantic Tags from Filename
    // Format: {Emotion}_{State}_{Variant}.ext
    const nameNoExt = filename.substring(0, filename.lastIndexOf('.'));
    const nameParts = nameNoExt.split('_');
    
    if (nameParts.length >= 3) {
      const [emotion, state, variant] = nameParts;
      if (emotion) tags.push(`emotion:${emotion.toLowerCase()}`);
      if (state) tags.push(`state:${state.toLowerCase()}`);
      if (variant) tags.push(`variant:${variant}`);
    } else if (nameParts.length === 2) {
      const [emotion, state] = nameParts;
      if (emotion) tags.push(`emotion:${emotion.toLowerCase()}`);
      if (state) tags.push(`state:${state.toLowerCase()}`);
    } else if (nameParts.length === 1) {
      if (nameParts[0]) tags.push(`emotion:${nameParts[0].toLowerCase()}`);
    }
    
  } else if (asset.path.includes('/VoiceSamples/')) {
    type = 'sound';
    tags.push('voice');
  }

  return { type, tags };
}
