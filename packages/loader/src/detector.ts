/**
 * Format Detector
 *
 * Detects the container format of character card data.
 */

import type { BinaryData } from '@character-foundry/core';
import { isPNG } from '@character-foundry/png';
import { isCharX, isJpegCharX } from '@character-foundry/charx';
import { isVoxta } from '@character-foundry/voxta';
import type { ContainerFormat, DetectionResult } from './types.js';

/**
 * PNG magic bytes
 */
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * ZIP magic bytes
 */
const ZIP_SIGNATURE = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

/**
 * JPEG magic bytes
 */
const JPEG_SIGNATURE = new Uint8Array([0xff, 0xd8, 0xff]);

/**
 * Check if data starts with a signature
 */
function startsWith(data: BinaryData, signature: Uint8Array): boolean {
  if (data.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (data[i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Check if data looks like JSON
 */
function looksLikeJson(data: BinaryData): boolean {
  // Skip BOM if present
  let offset = 0;
  if (data.length >= 3 && data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) {
    offset = 3;
  }

  // Skip whitespace
  while (offset < data.length) {
    const byte = data[offset]!;
    if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) {
      offset++;
    } else {
      break;
    }
  }

  // Check for JSON start
  if (offset >= data.length) return false;
  const firstChar = data[offset];
  return firstChar === 0x7b || firstChar === 0x5b; // '{' or '['
}

/**
 * Detect the container format of data
 */
export function detectFormat(data: BinaryData): DetectionResult {
  if (!data || data.length === 0) {
    return {
      format: 'unknown',
      confidence: 'high',
      reason: 'Empty data',
    };
  }

  // 1. Check for PNG
  if (startsWith(data, PNG_SIGNATURE) && isPNG(data)) {
    return {
      format: 'png',
      confidence: 'high',
      reason: 'Valid PNG signature and structure',
    };
  }

  // 2. Check for ZIP-based formats
  if (startsWith(data, ZIP_SIGNATURE)) {
    // Check for Voxta first (more specific)
    if (isVoxta(data)) {
      return {
        format: 'voxta',
        confidence: 'high',
        reason: 'ZIP with Voxta character.json structure',
      };
    }

    // Check for CharX
    if (isCharX(data)) {
      return {
        format: 'charx',
        confidence: 'high',
        reason: 'ZIP with card.json (CharX format)',
      };
    }

    // Unknown ZIP format
    return {
      format: 'unknown',
      confidence: 'medium',
      reason: 'ZIP archive without recognized card structure',
    };
  }

  // 3. Check for JPEG+ZIP hybrid (CharX with JPEG cover)
  if (startsWith(data, JPEG_SIGNATURE)) {
    if (isJpegCharX(data)) {
      return {
        format: 'charx',
        confidence: 'high',
        reason: 'JPEG with appended ZIP (CharX hybrid)',
      };
    }

    return {
      format: 'unknown',
      confidence: 'medium',
      reason: 'JPEG image without embedded card data',
    };
  }

  // 4. Check for raw JSON
  if (looksLikeJson(data)) {
    return {
      format: 'json',
      confidence: 'medium',
      reason: 'Data appears to be JSON',
    };
  }

  return {
    format: 'unknown',
    confidence: 'low',
    reason: 'Unrecognized format',
  };
}

/**
 * Quick check if data might be a character card
 */
export function mightBeCard(data: BinaryData): boolean {
  const result = detectFormat(data);
  return result.format !== 'unknown' || result.confidence !== 'low';
}
