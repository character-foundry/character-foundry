/**
 * @character-foundry/media
 *
 * Image processing utilities for character cards.
 * Works in both Node.js and browser environments.
 */

// Format detection
export {
  type ImageFormat,
  detectImageFormat,
  getMimeType,
  getExtension,
} from './format.js';

// Dimensions
export {
  type ImageDimensions,
  getImageDimensions,
} from './dimensions.js';

// Thumbnail generation
export {
  type ThumbnailOptions,
  createThumbnail,
  calculateThumbnailDimensions,
} from './thumbnail.js';
