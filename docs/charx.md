# CharX Package Documentation

**Package:** `@character-foundry/charx`
**Version:** 0.0.3
**Environment:** Node.js and Browser

The `@character-foundry/charx` package handles reading and writing CharX format files - a ZIP-based container format used by RisuAI that supports multiple assets.

## Features

- CharX ZIP archive reading and writing
- **JPEG+ZIP hybrid support** - Handles "mullet" format files (JPEG preview in front, ZIP data in back)
- RisuAI format compatibility
- Path traversal and zip bomb protection

## Table of Contents

- [Overview](#overview)
- [Format Structure](#format-structure)
- [Reader](#reader)
- [Writer](#writer)
- [JPEG+ZIP Hybrids](#jpegzip-hybrids)
- [Usage Examples](#usage-examples)

---

## Overview

CharX is a ZIP-based format that bundles:
- `card.json` - Character card data (CCv3)
- `assets/` - Images, audio, and other files
- Cover image (optional, for preview)

Benefits over PNG:
- Multiple assets (emotions, backgrounds, audio)
- Larger file support
- Better organization

---

## Format Structure

```
character.charx (ZIP archive)
├── card.json           # CCv3 character data
├── assets/
│   ├── avatar.png      # Character portrait
│   ├── happy.png       # Emotion: happy
│   ├── sad.png         # Emotion: sad
│   └── intro.mp3       # Audio asset
└── cover.png           # Optional cover image
```

### card.json

Standard CCv3 format with assets referencing files:

```json
{
  "spec": "chara_card_v3",
  "spec_version": "3.0",
  "data": {
    "name": "Character Name",
    "assets": [
      { "type": "icon", "uri": "embeded://assets/avatar.png", "name": "Avatar", "ext": "png" },
      { "type": "emotion", "uri": "embeded://assets/happy.png", "name": "Happy", "ext": "png" }
    ]
  }
}
```

---

## Reader

### Types

```typescript
interface CharxReadOptions {
  maxFileSize?: number;    // Per-file size limit (default: 50MB)
  maxTotalSize?: number;   // Total extracted size limit
  maxFiles?: number;       // Max files to extract
}

interface CharxAssetInfo {
  path: string;            // Path in ZIP
  name: string;            // Asset name
  type: string;            // Asset type (icon, emotion, etc.)
  mime: string;            // MIME type
  size: number;            // File size
}

interface CharxData {
  card: CCv3Data;          // Parsed card data
  assets: ExtractedAsset[]; // Extracted asset files
  cover?: Uint8Array;      // Cover image if present
  meta?: CharxMetaEntry[]; // File metadata
}
```

### Detection

```typescript
import { isCharX, isJpegCharX } from '@character-foundry/charx';

// Check if buffer is a CharX file
if (isCharX(data)) {
  // Valid ZIP with card.json
}

// Check if JPEG+ZIP hybrid
if (isJpegCharX(data)) {
  // JPEG in front, ZIP in back
}
```

### Reading

```typescript
import { readCharX, readCardJsonOnly, readCharXAsync } from '@character-foundry/charx';

// Synchronous read (loads all assets into memory)
const data = readCharX(buffer);
// data.card - CCv3Data
// data.assets - ExtractedAsset[]
// data.cover - Uint8Array | undefined

// Read only card.json (faster, less memory)
const card = readCardJsonOnly(buffer);

// Async read with streaming
const data = await readCharXAsync(buffer, {
  maxFileSize: 50 * 1024 * 1024,
});
```

---

## Writer

### Types

```typescript
type CompressionLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

interface CharxWriteAsset {
  path: string;            // Path in ZIP (e.g., 'assets/avatar.png')
  data: Uint8Array;        // File content
  compress?: boolean;      // Whether to compress (default: false for images)
}

interface CharxWriteOptions {
  compressionLevel?: CompressionLevel;  // 0=none, 9=max
  cover?: Uint8Array;      // Cover image to include
  preserveStructure?: boolean;  // Keep original file structure
}

interface CharxBuildResult {
  buffer: Uint8Array;      // Final ZIP buffer
  size: number;            // Total size
  fileCount: number;       // Number of files
}

// For async operations - fetch assets on demand
type AssetFetcher = (uri: string) => Promise<Uint8Array>;
```

### Writing

```typescript
import { writeCharX, writeCharXAsync } from '@character-foundry/charx';

// Synchronous write
const result = writeCharX(card, assets, {
  compressionLevel: 6,
  cover: coverImageBuffer,
});
// result.buffer - Final CharX file

// Async write with asset fetching
const result = await writeCharXAsync(card, async (uri) => {
  // Fetch asset data from URI
  return await fetchAsset(uri);
}, {
  compressionLevel: 6,
});
```

---

## JPEG+ZIP Hybrids

CharX supports a "mullet" format: JPEG in front, ZIP in back. This allows:
- Image previews in file browsers
- Full CharX data accessible to compatible apps

### How It Works

```
┌─────────────────────────────────┐
│ JPEG Header (FF D8 FF)          │
│ JPEG Image Data                 │  ← Valid JPEG image
│ JPEG End (FF D9)                │
├─────────────────────────────────┤
│ ZIP Header (50 4B 03 04)        │
│ ZIP Content                     │  ← Valid ZIP archive
│ ZIP Central Directory           │
│ ZIP End of Central Directory    │
└─────────────────────────────────┘
```

### Detection and Reading

```typescript
import { isJpegCharX, readCharX, getZipOffset } from '@character-foundry/charx';
import { getZipOffset } from '@character-foundry/core';

// Detect JPEG+ZIP
if (isJpegCharX(buffer)) {
  // Get offset where ZIP starts
  const zipStart = getZipOffset(buffer);

  // readCharX handles this automatically
  const data = readCharX(buffer);
}
```

### Why This Works

- JPEG readers stop at the EOI marker (FF D9)
- ZIP readers find the central directory at the END of file
- Both formats can coexist in one file

---

## Usage Examples

### Load CharX File

```typescript
import { isCharX, readCharX } from '@character-foundry/charx';
import { readFile } from 'fs/promises';

async function loadCharX(path: string) {
  const buffer = await readFile(path);

  if (!isCharX(buffer)) {
    throw new Error('Not a valid CharX file');
  }

  const { card, assets, cover } = readCharX(buffer);

  console.log(`Character: ${card.data.name}`);
  console.log(`Assets: ${assets.length}`);

  // List assets
  for (const asset of assets) {
    console.log(`  - ${asset.name} (${asset.type}): ${asset.data.length} bytes`);
  }

  return { card, assets, cover };
}
```

### Create CharX File

```typescript
import { writeCharX } from '@character-foundry/charx';
import { readFile, writeFile } from 'fs/promises';

async function createCharX(
  card: CCv3Data,
  assetPaths: { path: string; type: string }[]
) {
  // Load assets
  const assets: CharxWriteAsset[] = [];

  for (const { path, type } of assetPaths) {
    const data = await readFile(path);
    const filename = path.split('/').pop()!;

    assets.push({
      path: `assets/${filename}`,
      data,
      compress: false,  // Images don't compress well
    });
  }

  // Create CharX
  const { buffer } = writeCharX(card, assets, {
    compressionLevel: 6,
  });

  return buffer;
}
```

### Extract Specific Asset

```typescript
import { readCharX } from '@character-foundry/charx';

function getAvatar(charxBuffer: Uint8Array): Uint8Array | null {
  const { card, assets } = readCharX(charxBuffer);

  // Find avatar in card.data.assets
  const avatarDesc = card.data.assets?.find(a => a.type === 'icon');
  if (!avatarDesc) return null;

  // Find matching extracted asset
  const avatar = assets.find(a =>
    avatarDesc.uri.includes(a.name) || a.type === 'icon'
  );

  return avatar?.data ?? null;
}
```

### Convert PNG to CharX

```typescript
import { extractFromPNG } from '@character-foundry/png';
import { writeCharX, CharxWriteAsset } from '@character-foundry/charx';

function pngToCharX(pngBuffer: Uint8Array): Uint8Array {
  // Extract from PNG
  const { card, imageData } = extractFromPNG(pngBuffer);

  // Use the PNG as the avatar
  const assets: CharxWriteAsset[] = [{
    path: 'assets/avatar.png',
    data: imageData,
  }];

  // Update card to reference the asset
  card.data.assets = [{
    type: 'icon',
    uri: 'embeded://assets/avatar.png',
    name: 'Avatar',
    ext: 'png',
  }];

  // Write CharX
  const { buffer } = writeCharX(card, assets);
  return buffer;
}
```

### Handle Large Files with Streaming

```typescript
import { readCharXAsync } from '@character-foundry/charx';

async function loadLargeCharX(buffer: Uint8Array) {
  const data = await readCharXAsync(buffer, {
    maxFileSize: 100 * 1024 * 1024,  // 100MB per file
    maxTotalSize: 500 * 1024 * 1024, // 500MB total
    maxFiles: 500,
  });

  return data;
}
```

---

## Security Considerations

### Path Traversal

The reader validates all paths in the ZIP to prevent directory traversal attacks:

```typescript
// These paths are rejected:
// '../../../etc/passwd'
// '/absolute/path'
// 'assets/../../../secret'
```

### Size Limits

Default limits prevent memory exhaustion:
- **50MB** per file
- **50MB** total extracted size
- **1000** max files

```typescript
// Override limits (use with caution)
const data = readCharX(buffer, {
  maxFileSize: 100 * 1024 * 1024,
  maxTotalSize: 500 * 1024 * 1024,
});
```

### Zip Bombs

The reader tracks extracted size and stops if limits are exceeded, protecting against zip bombs (small compressed files that expand to huge sizes).
