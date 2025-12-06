/**
 * Common Types
 *
 * Shared types used across all card formats.
 */

/**
 * ISO 8601 date string
 */
export type ISO8601 = string;

/**
 * UUID string
 */
export type UUID = string;

/**
 * Card specification version
 */
export type Spec = 'v2' | 'v3';

/**
 * Source format identifier
 */
export type SourceFormat =
  | 'png_v2'        // PNG with 'chara' chunk (v2)
  | 'png_v3'        // PNG with 'ccv3' chunk (v3)
  | 'json_v2'       // Raw JSON v2
  | 'json_v3'       // Raw JSON v3
  | 'charx'         // ZIP with card.json (v3 spec)
  | 'charx_risu'    // ZIP with card.json + module.risum
  | 'charx_jpeg'    // JPEG with appended ZIP (read-only)
  | 'voxta';        // VoxPkg format

/**
 * Original JSON shape
 */
export type OriginalShape = 'wrapped' | 'unwrapped' | 'legacy';

/**
 * Asset type identifier
 */
export type AssetType =
  | 'icon'
  | 'background'
  | 'emotion'
  | 'user_icon'
  | 'sound'
  | 'video'
  | 'custom'
  | 'x-risu-asset';

/**
 * Asset descriptor (v3 spec)
 */
export interface AssetDescriptor {
  type: AssetType;
  uri: string;
  name: string;
  ext: string;
}

/**
 * Extracted asset with binary data
 */
export interface ExtractedAsset {
  descriptor: AssetDescriptor;
  data: Uint8Array;
  mimeType: string;
}
