import { isImageExt, isAudioExt, isVideoExt } from '@character-foundry/core';

/**
 * Convert a CHARX embeded:// path to an internal reference
 */
export function embedToInternal(embedPath: string): string {
  // Remove embeded:// prefix if present
  const path = embedPath.startsWith('embeded://') ? embedPath.substring('embeded://'.length) : embedPath;

  // Extract filename or use the full path as reference
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

/**
 * Convert an internal asset ID to a CHARX embeded:// URI
 */
export function internalToEmbed(_assetId: string, type: string, ext: string, index: number): string {
  // Organize by type following CHARX conventions
  let subdir = 'other';

  if (type === 'icon') {
    subdir = 'icon';
  } else if (type === 'background') {
    subdir = 'background';
  } else if (type === 'emotion') {
    subdir = 'emotion';
  } else if (type === 'user_icon') {
    subdir = 'user_icon';
  }

  // Determine media subdirectory
  const mediaType = isImageExt(ext) ? 'image' : isAudioExt(ext) ? 'audio' : isVideoExt(ext) ? 'video' : 'other';

  return `embeded://assets/${subdir}/${mediaType}/${index}.${ext}`;
}
