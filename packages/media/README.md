# @character-foundry/media

Image format detection, dimensions, and thumbnail generation.

## Installation

```bash
npm install @character-foundry/media
```

## Features

- **Format detection** - PNG, JPEG, WebP, GIF, AVIF
- **Dimension extraction** - Width/height without full decode
- **Thumbnail generation** - Resize images for previews
- **Magic number detection** - Reliable format identification

## Quick Start

```typescript
import {
  detectImageFormat,
  getImageDimensions,
  generateThumbnail,
} from '@character-foundry/media';

// Detect format from bytes
const format = detectImageFormat(buffer);
// 'png' | 'jpeg' | 'webp' | 'gif' | 'avif' | null

// Get dimensions without full decode
const dims = getImageDimensions(buffer);
// { width: 512, height: 512 }

// Generate thumbnail
const thumb = await generateThumbnail(buffer, {
  maxWidth: 128,
  maxHeight: 128,
  format: 'webp',
  quality: 80,
});
```

## Documentation

See [docs/media.md](../../docs/media.md) for full API documentation.

## License

MIT
