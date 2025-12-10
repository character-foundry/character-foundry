# Media Package Documentation

The `@character-foundry/media` package provides image processing utilities for character cards - format detection, dimension parsing, and thumbnail generation.

## Table of Contents

- [Overview](#overview)
- [Format Detection](#format-detection)
- [Image Dimensions](#image-dimensions)
- [Thumbnail Generation](#thumbnail-generation)
- [Usage Examples](#usage-examples)

---

## Overview

Character cards often include embedded images (avatars, emotions, backgrounds). This package provides utilities to:

- Detect image format from binary data (no file extension needed)
- Parse image dimensions without full decode
- Generate thumbnails for previews

Works in both Node.js and browser environments.

---

## Format Detection

Detect image format from magic bytes.

```typescript
import { detectImageFormat, getMimeType, getExtension } from '@character-foundry/media';

// Detect format from binary data
const format = detectImageFormat(imageData);
// Returns: 'png' | 'jpeg' | 'gif' | 'webp' | 'avif' | 'bmp' | null

// Get MIME type
const mime = getMimeType(format);
// 'image/png', 'image/jpeg', etc.

// Get file extension
const ext = getExtension(format);
// 'png', 'jpg', 'gif', etc.
```

### Supported Formats

| Format | Magic Bytes | MIME Type |
|--------|-------------|-----------|
| PNG | `89 50 4E 47` | `image/png` |
| JPEG | `FF D8 FF` | `image/jpeg` |
| GIF | `47 49 46 38` | `image/gif` |
| WebP | `52 49 46 46...57 45 42 50` | `image/webp` |
| AVIF | `...66 74 79 70 61 76 69 66` | `image/avif` |
| BMP | `42 4D` | `image/bmp` |

---

## Image Dimensions

Parse image dimensions from headers without decoding the full image.

```typescript
import { getImageDimensions } from '@character-foundry/media';

const dimensions = getImageDimensions(imageData);
// { width: 512, height: 512, format: 'png' }

// Returns null if format is unsupported or data is invalid
if (dimensions) {
  console.log(`${dimensions.width}x${dimensions.height} ${dimensions.format}`);
}
```

### ImageDimensions Interface

```typescript
interface ImageDimensions {
  width: number;
  height: number;
  format: ImageFormat;
}
```

### Format-Specific Parsing

| Format | Method |
|--------|--------|
| PNG | IHDR chunk (bytes 16-24) |
| JPEG | SOF0/SOF2 markers |
| GIF | Logical Screen Descriptor |
| WebP | VP8/VP8L/VP8X chunks |
| AVIF | ispe box in meta |

---

## Thumbnail Generation

Generate thumbnails for image previews.

```typescript
import { createThumbnail } from '@character-foundry/media';

// Basic usage (defaults: 256x256, JPEG, quality 80)
const thumbnail = await createThumbnail(imageData);

// With options
const thumbnail = await createThumbnail(imageData, {
  maxWidth: 128,
  maxHeight: 128,
  format: 'png',     // 'jpeg' | 'png' | 'webp'
  quality: 90,       // 1-100, for JPEG/WebP
});
```

### ThumbnailOptions Interface

```typescript
interface ThumbnailOptions {
  /** Maximum width (default: 256) */
  maxWidth?: number;
  /** Maximum height (default: 256) */
  maxHeight?: number;
  /** Output format (default: 'jpeg') */
  format?: 'jpeg' | 'png' | 'webp';
  /** Quality 1-100 for JPEG/WebP (default: 80) */
  quality?: number;
}
```

### Environment Support

| Environment | Implementation |
|-------------|----------------|
| Node.js | Uses `sharp` (optional dependency) |
| Browser | Uses Canvas API |
| Cloudflare Workers | Not supported (no canvas) |

**Note:** In Node.js, `sharp` must be installed:
```bash
pnpm add sharp
```

---

## Usage Examples

### Validate Avatar Upload

```typescript
import { detectImageFormat, getImageDimensions } from '@character-foundry/media';

function validateAvatar(data: Uint8Array): { valid: boolean; error?: string } {
  const format = detectImageFormat(data);

  if (!format) {
    return { valid: false, error: 'Unknown image format' };
  }

  if (!['png', 'jpeg', 'webp'].includes(format)) {
    return { valid: false, error: `Unsupported format: ${format}` };
  }

  const dims = getImageDimensions(data);
  if (!dims) {
    return { valid: false, error: 'Could not read image dimensions' };
  }

  if (dims.width > 2048 || dims.height > 2048) {
    return { valid: false, error: 'Image too large (max 2048x2048)' };
  }

  if (dims.width < 64 || dims.height < 64) {
    return { valid: false, error: 'Image too small (min 64x64)' };
  }

  return { valid: true };
}
```

### Generate Card Preview

```typescript
import { createThumbnail, detectImageFormat } from '@character-foundry/media';

async function generatePreview(avatarData: Uint8Array): Promise<string> {
  const thumbnail = await createThumbnail(avatarData, {
    maxWidth: 200,
    maxHeight: 200,
    format: 'webp',
    quality: 85,
  });

  // Convert to data URL
  const base64 = btoa(String.fromCharCode(...thumbnail));
  return `data:image/webp;base64,${base64}`;
}
```

### Process Card Assets

```typescript
import { detectImageFormat, getImageDimensions, getMimeType } from '@character-foundry/media';
import type { ExtractedAsset } from '@character-foundry/schemas';

interface AssetInfo {
  type: string;
  name: string;
  format: string;
  mime: string;
  width?: number;
  height?: number;
  size: number;
}

function analyzeAssets(assets: ExtractedAsset[]): AssetInfo[] {
  return assets.map(asset => {
    const format = detectImageFormat(asset.data);
    const dims = format ? getImageDimensions(asset.data) : null;

    return {
      type: asset.type,
      name: asset.name,
      format: format || 'unknown',
      mime: format ? getMimeType(format) : 'application/octet-stream',
      width: dims?.width,
      height: dims?.height,
      size: asset.data.length,
    };
  });
}
```

### Batch Thumbnail Generation

```typescript
import { createThumbnail } from '@character-foundry/media';

async function generateThumbnails(
  images: Uint8Array[],
  options: ThumbnailOptions = {}
): Promise<Uint8Array[]> {
  return Promise.all(
    images.map(img => createThumbnail(img, options))
  );
}
```

---

## Error Handling

All functions handle invalid input gracefully:

```typescript
// Returns null for unknown format
const format = detectImageFormat(new Uint8Array([0, 0, 0, 0]));
// null

// Returns null for invalid image
const dims = getImageDimensions(new Uint8Array([0, 0, 0, 0]));
// null

// Throws for thumbnail generation failures
try {
  const thumb = await createThumbnail(invalidData);
} catch (error) {
  console.error('Thumbnail generation failed:', error);
}
```
