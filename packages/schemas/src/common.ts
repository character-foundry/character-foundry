/**
 * Common Types
 *
 * Shared types used across all card formats.
 */

import { z } from 'zod';

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * ISO 8601 date string schema
 */
export const ISO8601Schema = z.string().datetime();

/**
 * UUID string schema
 */
export const UUIDSchema = z.string().uuid();

/**
 * Card specification version schema
 */
export const SpecSchema = z.enum(['v2', 'v3']);

/**
 * Source format identifier schema
 */
export const SourceFormatSchema = z.enum([
  'png_v2',        // PNG with 'chara' chunk (v2)
  'png_v3',        // PNG with 'ccv3' chunk (v3)
  'json_v2',       // Raw JSON v2
  'json_v3',       // Raw JSON v3
  'charx',         // ZIP with card.json (v3 spec)
  'charx_risu',    // ZIP with card.json + module.risum
  'charx_jpeg',    // JPEG with appended ZIP (read-only)
  'voxta',         // VoxPkg format
]);

/**
 * Original JSON shape schema
 */
export const OriginalShapeSchema = z.enum(['wrapped', 'unwrapped', 'legacy']);

/**
 * Asset type identifier schema
 */
export const AssetTypeSchema = z.enum([
  'icon',
  'background',
  'emotion',
  'user_icon',
  'sound',
  'video',
  'custom',
  'x-risu-asset',
]);

/**
 * Asset descriptor schema (v3 spec)
 */
export const AssetDescriptorSchema = z.object({
  type: AssetTypeSchema,
  uri: z.string(),
  name: z.string(),
  ext: z.string(),
});

/**
 * Extracted asset with binary data schema
 */
export const ExtractedAssetSchema = z.object({
  descriptor: AssetDescriptorSchema,
  data: z.instanceof(Uint8Array),
  mimeType: z.string(),
});

// ============================================================================
// TypeScript Types (inferred from Zod schemas)
// ============================================================================

/**
 * ISO 8601 date string
 */
export type ISO8601 = z.infer<typeof ISO8601Schema>;

/**
 * UUID string
 */
export type UUID = z.infer<typeof UUIDSchema>;

/**
 * Card specification version
 */
export type Spec = z.infer<typeof SpecSchema>;

/**
 * Source format identifier
 */
export type SourceFormat = z.infer<typeof SourceFormatSchema>;

/**
 * Original JSON shape
 */
export type OriginalShape = z.infer<typeof OriginalShapeSchema>;

/**
 * Asset type identifier
 */
export type AssetType = z.infer<typeof AssetTypeSchema>;

/**
 * Asset descriptor (v3 spec)
 */
export type AssetDescriptor = z.infer<typeof AssetDescriptorSchema>;

/**
 * Extracted asset with binary data
 */
export type ExtractedAsset = z.infer<typeof ExtractedAssetSchema>;
