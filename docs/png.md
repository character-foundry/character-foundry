# PNG Package Documentation

The `@character-foundry/png` package handles reading and writing character card data embedded in PNG files using tEXt/zTXt chunks.

## Table of Contents

- [Overview](#overview)
- [Parser](#parser)
- [Builder](#builder)
- [CRC32](#crc32)
- [Usage Examples](#usage-examples)

---

## Overview

Character cards are typically distributed as PNG images with JSON data embedded in text chunks:

- **tEXt chunk**: Uncompressed text with keyword
- **zTXt chunk**: Compressed text with keyword

Common keywords:
- `chara` - Base64-encoded JSON character data
- `ccv3` - Character Card V3 data
- `comment` - Metadata comments

---

## Parser

Extract character data from PNG files.

### Constants

```typescript
import { PNG_SIGNATURE, TEXT_CHUNK_KEYS } from '@character-foundry/png';

// PNG magic bytes
PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// Known text chunk keywords for character data
TEXT_CHUNK_KEYS = ['chara', 'ccv3'];
```

### Types

```typescript
interface TextChunk {
  keyword: string;  // 'chara', 'ccv3', 'comment', etc.
  text: string;     // Raw text content (may be base64)
  compressed: boolean;
}

interface PNGExtractionResult {
  card: CCv3Data;           // Parsed and normalized card data
  imageData: Uint8Array;    // Original PNG (stripped of text chunks)
  originalShape: 'v2' | 'v3';
  rawText?: string;         // Original text before parsing
}
```

### Detection

```typescript
import { isPNG } from '@character-foundry/png';

// Check if buffer is a valid PNG
if (isPNG(data)) {
  // First 8 bytes match PNG signature
}
```

### Parsing

```typescript
import { parseTextChunks, listChunks, extractFromPNG } from '@character-foundry/png';

// List all PNG chunks (for debugging)
const chunks = listChunks(pngBuffer);
// [{ type: 'IHDR', length: 13, offset: 8 }, { type: 'tEXt', ... }, ...]

// Extract all text chunks
const textChunks = parseTextChunks(pngBuffer);
// [{ keyword: 'chara', text: 'eyJzcGVj...', compressed: false }]

// Full extraction with normalization
const result = extractFromPNG(pngBuffer);
// result.card - CCv3Data (always v3)
// result.imageData - Clean PNG without text chunks
// result.originalShape - 'v2' or 'v3'
```

---

## Builder

Embed character data into PNG files.

### Types

```typescript
interface EmbedOptions {
  keyword?: string;      // Default: 'chara'
  compress?: boolean;    // Use zTXt instead of tEXt
  stripExisting?: boolean; // Remove existing text chunks first
}
```

### Functions

```typescript
import {
  removeAllTextChunks,
  injectTextChunk,
  embedIntoPNG,
  validatePNGSize,
} from '@character-foundry/png';

// Remove all tEXt/zTXt chunks from PNG
const cleanPng = removeAllTextChunks(pngBuffer);

// Inject a text chunk
const withChunk = injectTextChunk(pngBuffer, 'chara', base64Data, {
  compress: false,
  stripExisting: true,
});

// High-level: embed card into PNG
const result = embedIntoPNG(pngBuffer, cardJson, {
  keyword: 'chara',
  compress: false,
  stripExisting: true,
});
// Returns PNG buffer with embedded card

// Validate PNG size before embedding
validatePNGSize(pngBuffer);
// Throws if image is too large
```

### Compression

When `compress: true`, the text chunk uses zlib deflate compression (zTXt chunk type). This reduces file size for large character cards but requires decompression on read.

```typescript
// Compressed embedding
const compressed = embedIntoPNG(png, cardJson, { compress: true });

// Uncompressed (better compatibility)
const uncompressed = embedIntoPNG(png, cardJson, { compress: false });
```

---

## CRC32

PNG chunks include CRC32 checksums for integrity verification.

```typescript
import { crc32, crc32Bytes } from '@character-foundry/png';

// Calculate CRC32 of a buffer
const checksum = crc32(data);  // Returns number

// Get CRC32 as 4-byte big-endian array
const bytes = crc32Bytes(data);  // Returns Uint8Array(4)
```

---

## Usage Examples

### Extract Character from PNG

```typescript
import { isPNG, extractFromPNG } from '@character-foundry/png';
import { readFile } from 'fs/promises';

async function loadCharacter(path: string) {
  const buffer = await readFile(path);

  if (!isPNG(buffer)) {
    throw new Error('Not a PNG file');
  }

  const { card, imageData, originalShape } = extractFromPNG(buffer);

  console.log(`Loaded: ${card.data.name}`);
  console.log(`Original format: ${originalShape}`);
  console.log(`Image size: ${imageData.length} bytes`);

  return card;
}
```

### Embed Character into PNG

```typescript
import { embedIntoPNG, removeAllTextChunks } from '@character-foundry/png';
import { readFile, writeFile } from 'fs/promises';

async function saveCharacter(
  imagePath: string,
  card: CCv3Data,
  outputPath: string
) {
  // Load image
  const imageBuffer = await readFile(imagePath);

  // Convert card to JSON string
  const cardJson = JSON.stringify(card);

  // Embed into PNG
  const result = embedIntoPNG(imageBuffer, cardJson, {
    keyword: 'chara',
    stripExisting: true,
  });

  await writeFile(outputPath, result);
}
```

### Debug PNG Chunks

```typescript
import { listChunks, parseTextChunks } from '@character-foundry/png';

function debugPNG(buffer: Uint8Array) {
  console.log('PNG Chunks:');
  for (const chunk of listChunks(buffer)) {
    console.log(`  ${chunk.type}: ${chunk.length} bytes at offset ${chunk.offset}`);
  }

  console.log('\nText Chunks:');
  for (const text of parseTextChunks(buffer)) {
    console.log(`  ${text.keyword}: ${text.text.length} chars (compressed: ${text.compressed})`);
  }
}
```

### Clean PNG (Remove All Text)

```typescript
import { removeAllTextChunks } from '@character-foundry/png';

// Strip all metadata from PNG for privacy
const cleanImage = removeAllTextChunks(dirtyPng);
```

---

## PNG Structure Reference

```
┌─────────────────────────────────┐
│ PNG Signature (8 bytes)         │
│ 89 50 4E 47 0D 0A 1A 0A        │
├─────────────────────────────────┤
│ IHDR Chunk (Image Header)       │
│ - Width, Height                 │
│ - Bit depth, Color type         │
├─────────────────────────────────┤
│ tEXt Chunk (keyword=chara)      │ ← Character data here
│ - Base64-encoded JSON           │
├─────────────────────────────────┤
│ IDAT Chunks (Image Data)        │
│ - Compressed pixel data         │
├─────────────────────────────────┤
│ IEND Chunk (End marker)         │
└─────────────────────────────────┘
```

### Chunk Format

Each chunk:
```
┌──────────────────────────────────────────┐
│ Length (4 bytes, big-endian)             │
│ Type (4 bytes, e.g., 'tEXt')             │
│ Data (Length bytes)                      │
│ CRC32 (4 bytes)                          │
└──────────────────────────────────────────┘
```

### tEXt Chunk Data

```
┌──────────────────────────────────────────┐
│ Keyword (e.g., 'chara')                  │
│ Null separator (0x00)                    │
│ Text data (base64 JSON)                  │
└──────────────────────────────────────────┘
```

### zTXt Chunk Data

```
┌──────────────────────────────────────────┐
│ Keyword (e.g., 'chara')                  │
│ Null separator (0x00)                    │
│ Compression method (0x00 = zlib)         │
│ Compressed text data                     │
└──────────────────────────────────────────┘
```
