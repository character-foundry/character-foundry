/**
 * URI Utilities
 *
 * Handles different asset URI schemes used in character cards.
 * Supports: embeded://, embedded://, ccdefault:, https://, http://,
 * data:, file://, __asset:, asset:, chara-ext-asset_
 */

export type URIScheme =
  | 'embeded'      // embeded:// (CharX standard, note intentional typo)
  | 'ccdefault'    // ccdefault:
  | 'https'        // https://
  | 'http'         // http://
  | 'data'         // data:mime;base64,...
  | 'file'         // file://
  | 'internal'     // Internal asset ID (UUID/string)
  | 'pngchunk'     // PNG chunk reference (__asset:, asset:, chara-ext-asset_)
  | 'unknown';

export interface ParsedURI {
  scheme: URIScheme;
  originalUri: string;
  normalizedUri: string;      // Normalized form of the URI
  path?: string;              // For embeded://, file://
  url?: string;               // For http://, https://
  data?: string;              // For data: URIs
  mimeType?: string;          // For data: URIs
  encoding?: string;          // For data: URIs (e.g., base64)
  chunkKey?: string;          // For pngchunk - the key/index to look up
  chunkCandidates?: string[]; // For pngchunk - all possible chunk keys to search
}

/**
 * Normalize a URI to its canonical form
 * Handles common typos and variant formats
 */
export function normalizeURI(uri: string): string {
  const trimmed = uri.trim();

  // Fix embedded:// -> embeded:// (common typo, CharX spec uses single 'd')
  if (trimmed.startsWith('embedded://')) {
    return 'embeded://' + trimmed.substring('embedded://'.length);
  }

  // Normalize PNG chunk references to pngchunk: scheme
  if (trimmed.startsWith('__asset:')) {
    const id = trimmed.substring('__asset:'.length);
    return `pngchunk:${id}`;
  }
  if (trimmed.startsWith('asset:')) {
    const id = trimmed.substring('asset:'.length);
    return `pngchunk:${id}`;
  }
  if (trimmed.startsWith('chara-ext-asset_:')) {
    const id = trimmed.substring('chara-ext-asset_:'.length);
    return `pngchunk:${id}`;
  }
  if (trimmed.startsWith('chara-ext-asset_')) {
    const id = trimmed.substring('chara-ext-asset_'.length);
    return `pngchunk:${id}`;
  }

  return trimmed;
}

/**
 * Parse a URI and determine its scheme and components
 */
export function parseURI(uri: string): ParsedURI {
  const trimmed = uri.trim();
  const normalized = normalizeURI(trimmed);

  // PNG chunk references (__asset:, asset:, chara-ext-asset_)
  if (
    trimmed.startsWith('__asset:') ||
    trimmed.startsWith('asset:') ||
    trimmed.startsWith('chara-ext-asset_')
  ) {
    let assetId: string;
    if (trimmed.startsWith('__asset:')) {
      assetId = trimmed.substring('__asset:'.length);
    } else if (trimmed.startsWith('asset:')) {
      assetId = trimmed.substring('asset:'.length);
    } else if (trimmed.startsWith('chara-ext-asset_:')) {
      assetId = trimmed.substring('chara-ext-asset_:'.length);
    } else {
      assetId = trimmed.substring('chara-ext-asset_'.length);
    }

    // Generate all possible chunk key variations for lookup
    const candidates = [
      assetId,                        // "0" or "filename.png"
      trimmed,                        // Original URI
      `asset:${assetId}`,             // "asset:0"
      `__asset:${assetId}`,           // "__asset:0"
      `__asset_${assetId}`,           // "__asset_0"
      `chara-ext-asset_${assetId}`,   // "chara-ext-asset_0"
      `chara-ext-asset_:${assetId}`,  // "chara-ext-asset_:0"
    ];

    return {
      scheme: 'pngchunk',
      originalUri: uri,
      normalizedUri: normalized,
      chunkKey: assetId,
      chunkCandidates: candidates,
    };
  }

  // ccdefault: - use default asset
  if (trimmed === 'ccdefault:' || trimmed.startsWith('ccdefault:')) {
    return {
      scheme: 'ccdefault',
      originalUri: uri,
      normalizedUri: normalized,
    };
  }

  // embeded:// or embedded:// (normalize typo)
  if (trimmed.startsWith('embeded://') || trimmed.startsWith('embedded://')) {
    const path = trimmed.startsWith('embeded://')
      ? trimmed.substring('embeded://'.length)
      : trimmed.substring('embedded://'.length);
    return {
      scheme: 'embeded',
      originalUri: uri,
      normalizedUri: normalized,
      path,
    };
  }

  // https://
  if (trimmed.startsWith('https://')) {
    return {
      scheme: 'https',
      originalUri: uri,
      normalizedUri: normalized,
      url: trimmed,
    };
  }

  // http://
  if (trimmed.startsWith('http://')) {
    return {
      scheme: 'http',
      originalUri: uri,
      normalizedUri: normalized,
      url: trimmed,
    };
  }

  // data: URIs
  if (trimmed.startsWith('data:')) {
    const parsed = parseDataURI(trimmed);
    return {
      scheme: 'data',
      originalUri: uri,
      normalizedUri: normalized,
      ...parsed,
    };
  }

  // file://
  if (trimmed.startsWith('file://')) {
    const path = trimmed.substring('file://'.length);
    return {
      scheme: 'file',
      originalUri: uri,
      normalizedUri: normalized,
      path,
    };
  }

  // Internal asset ID (alphanumeric/UUID format)
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return {
      scheme: 'internal',
      originalUri: uri,
      normalizedUri: normalized,
      path: trimmed,
    };
  }

  // Unknown scheme
  return {
    scheme: 'unknown',
    originalUri: uri,
    normalizedUri: normalized,
  };
}

/**
 * Parse a data URI into its components
 * Format: data:[<mediatype>][;base64],<data>
 */
function parseDataURI(uri: string): { mimeType?: string; encoding?: string; data?: string } {
  const match = uri.match(/^data:([^;,]+)?(;base64)?,(.*)$/);

  if (!match) {
    return {};
  }

  return {
    mimeType: match[1] || 'text/plain',
    encoding: match[2] ? 'base64' : undefined,
    data: match[3],
  };
}

/**
 * Check if extension is an image format
 */
export function isImageExt(ext: string): boolean {
  const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'bmp', 'svg'];
  return imageExts.includes(ext.toLowerCase());
}

/**
 * Check if extension is an audio format
 */
export function isAudioExt(ext: string): boolean {
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'];
  return audioExts.includes(ext.toLowerCase());
}

/**
 * Check if extension is a video format
 */
export function isVideoExt(ext: string): boolean {
  const videoExts = ['mp4', 'webm', 'avi', 'mov', 'mkv'];
  return videoExts.includes(ext.toLowerCase());
}

/**
 * Validate if a URI is safe to use
 */
export function isURISafe(uri: string, options: { allowHttp?: boolean; allowFile?: boolean } = {}): boolean {
  const parsed = parseURI(uri);

  switch (parsed.scheme) {
    case 'embeded':
    case 'ccdefault':
    case 'internal':
    case 'data':
    case 'https':
    case 'pngchunk':
      return true;

    case 'http':
      return options.allowHttp === true;

    case 'file':
      return options.allowFile === true;

    case 'unknown':
    default:
      return false;
  }
}

/**
 * Extract file extension from URI
 */
export function getExtensionFromURI(uri: string): string {
  const parsed = parseURI(uri);

  if (parsed.path) {
    const parts = parsed.path.split('.');
    if (parts.length > 1) {
      return parts[parts.length - 1]!.toLowerCase();
    }
  }

  if (parsed.url) {
    const urlParts = parsed.url.split('?')[0]!.split('.');
    if (urlParts.length > 1) {
      return urlParts[urlParts.length - 1]!.toLowerCase();
    }
  }

  if (parsed.mimeType) {
    return getExtFromMimeType(parsed.mimeType);
  }

  return 'unknown';
}

/**
 * Get MIME type from file extension
 */
export function getMimeTypeFromExt(ext: string): string {
  const extToMime: Record<string, string> = {
    // Images
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
    'gif': 'image/gif',
    'avif': 'image/avif',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon',

    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac',
    'm4a': 'audio/mp4',
    'aac': 'audio/aac',

    // Video
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'mkv': 'video/x-matroska',

    // Text/Data
    'json': 'application/json',
    'txt': 'text/plain',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
  };

  return extToMime[ext.toLowerCase()] || 'application/octet-stream';
}

/**
 * Get file extension from MIME type
 */
export function getExtFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/x-icon': 'ico',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/x-msvideo': 'avi',
    'video/quicktime': 'mov',
    'video/x-matroska': 'mkv',
    'application/json': 'json',
    'text/plain': 'txt',
    'text/html': 'html',
    'text/css': 'css',
    'application/javascript': 'js',
  };

  return mimeToExt[mimeType] || 'bin';
}

/**
 * Build a data URI from binary data and MIME type
 */
export function buildDataURI(data: string, mimeType: string, isBase64 = true): string {
  if (isBase64) {
    return `data:${mimeType};base64,${data}`;
  }
  return `data:${mimeType},${encodeURIComponent(data)}`;
}
