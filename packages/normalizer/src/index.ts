/**
 * @character-foundry/normalizer
 *
 * Character card normalization - convert between CCv2, CCv3, and NormalizedCard formats.
 */

// v2 <-> v3 conversion
export { ccv2ToCCv3 } from './v2-to-v3.js';
export {
  ccv3ToCCv2Data,
  ccv3ToCCv2Wrapped,
  checkV3ToV2Loss,
  V3_TO_V2_LOST_FIELDS,
} from './v3-to-v2.js';

// To NormalizedCard
export {
  normalize,
  normalizeV2,
  normalizeV3,
} from './to-normalized.js';

// From NormalizedCard
export {
  denormalizeToV3,
  denormalizeToV2Data,
  denormalizeToV2Wrapped,
  checkNormalizedToV2Loss,
} from './from-normalized.js';
