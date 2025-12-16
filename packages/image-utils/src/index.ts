/**
 * @character-foundry/image-utils
 *
 * Image URL extraction and SSRF protection for character cards.
 * Browser-safe utilities used across Federation, Archive, and Architect.
 */

// Extraction
export {
  type ImageExtractionOptions,
  type ExtractedImage,
  extractImageUrls,
  extractRemoteImageUrls,
  extractDataUrls,
  countImages,
} from './extraction.js';

// SSRF protection
export {
  type SSRFPolicy,
  type SafetyCheck,
  DEFAULT_SSRF_POLICY,
  isURLSafe,
  isSafeForFetch,
  filterSafeUrls,
} from './ssrf.js';
