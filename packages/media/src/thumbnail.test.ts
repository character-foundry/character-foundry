/**
 * Thumbnail generation tests
 */

import { describe, it, expect } from 'vitest';
import { calculateThumbnailDimensions } from './thumbnail.js';

describe('thumbnail', () => {
  describe('calculateThumbnailDimensions', () => {
    it('should preserve dimensions if within max size', () => {
      expect(calculateThumbnailDimensions(200, 150, 400)).toEqual({
        width: 200,
        height: 150,
      });
    });

    it('should scale down landscape image', () => {
      const result = calculateThumbnailDimensions(1000, 500, 400);
      expect(result.width).toBe(400);
      expect(result.height).toBe(200);
    });

    it('should scale down portrait image', () => {
      const result = calculateThumbnailDimensions(500, 1000, 400);
      expect(result.width).toBe(200);
      expect(result.height).toBe(400);
    });

    it('should scale down square image', () => {
      const result = calculateThumbnailDimensions(800, 800, 400);
      expect(result.width).toBe(400);
      expect(result.height).toBe(400);
    });

    it('should handle exact max size', () => {
      expect(calculateThumbnailDimensions(400, 400, 400)).toEqual({
        width: 400,
        height: 400,
      });
    });

    it('should handle width at max, height under', () => {
      expect(calculateThumbnailDimensions(400, 200, 400)).toEqual({
        width: 400,
        height: 200,
      });
    });

    it('should handle height at max, width under', () => {
      expect(calculateThumbnailDimensions(200, 400, 400)).toEqual({
        width: 200,
        height: 400,
      });
    });

    it('should handle very large images', () => {
      const result = calculateThumbnailDimensions(10000, 5000, 400);
      expect(result.width).toBe(400);
      expect(result.height).toBe(200);
    });
  });
});

// Note: createThumbnail tests require actual image files and
// either sharp (Node.js) or Canvas API (browser) to be available.
// These would be integration tests with real fixtures.
