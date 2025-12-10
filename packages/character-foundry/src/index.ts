/**
 * Character Foundry - Universal AI character card library
 *
 * This meta package re-exports all Character Foundry packages.
 * Install this single package to get everything:
 *
 * ```bash
 * pnpm add @character-foundry/character-foundry
 * ```
 *
 * Then import from subpaths:
 * ```typescript
 * import { parseCard } from '@character-foundry/character-foundry/loader';
 * import { exportCard } from '@character-foundry/character-foundry/exporter';
 * ```
 *
 * Or import specific packages directly:
 * ```typescript
 * import { parseCard } from '@character-foundry/loader';
 * ```
 */

// Re-export the most common utilities from loader/exporter for convenience
export { parseCard, parseCardAsync, detectFormat, type ParseResult, type ExtractedAsset } from '@character-foundry/loader';
export { exportCard, checkExportLoss } from '@character-foundry/exporter';

// Re-export types from schemas
export type {
  CCv2Data,
  CCv3Data,
  CCv3CharacterBook,
} from '@character-foundry/schemas';

// Re-export spec detection
export { detectSpec, type SpecDetectionResult } from '@character-foundry/schemas';
