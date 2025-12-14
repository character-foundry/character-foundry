# Loader Package Documentation

**Package:** `@character-foundry/loader`
**Version:** 0.1.8
**Environment:** Node.js and Browser

The `@character-foundry/loader` package provides universal character card and lorebook loading with automatic format detection. It handles PNG, CharX, Voxta, raw JSON character cards, and standalone lorebook files.

## Features

- **Universal loading** - `parseCard()` for cards, `parseLorebook()` for lorebooks, `parse()` for both
- Automatic format detection (PNG, CharX, Voxta, JSON, Lorebook)
- Normalization to CCv3 format
- **Discriminated union result** - `parse()` returns `CardParseResult | LorebookParseResult`
- **Server-side metadata validation** - `validateClientMetadata()`, `computeContentHash()`
- Optimistic UI support with authoritative server validation

## Table of Contents

- [Overview](#overview)
- [Format Detection](#format-detection)
- [Parsing](#parsing)
- [Lorebook Parsing](#lorebook-parsing)
- [Universal Parser](#universal-parser)
- [Usage Examples](#usage-examples)
- [Server-side Metadata Validation](#server-side-metadata-validation)

---

## Overview

The loader is the main entry point for reading character cards. It:

1. **Detects** the container format (PNG, CharX, Voxta, JSON)
2. **Extracts** the character data and assets
3. **Normalizes** to CCv3 format
4. **Preserves** original shape information for round-trip

```typescript
import { parseCard } from '@character-foundry/loader';

const { card, assets, containerFormat, spec, sourceFormat } = parseCard(buffer);
// card: Always CCv3Data
// assets: Extracted images, audio, etc.
// containerFormat: 'png' | 'charx' | 'voxta' | 'json'
// spec: 'chara_card_v2' | 'chara_card_v3' (detected spec version)
// sourceFormat: 'ccv2' | 'ccv3' | 'voxta' | ... (source format indicator)
```

---

## Format Detection

### Types

```typescript
type ContainerFormat = 'png' | 'charx' | 'voxta' | 'json' | 'lorebook' | 'unknown';

interface DetectionResult {
  format: ContainerFormat;
  confidence: 'high' | 'medium' | 'low';
  details?: string;
}
```

### Detection Functions

```typescript
import { detectFormat, mightBeCard } from '@character-foundry/loader';

// Detect container format
const result = detectFormat(buffer);
// result.format: 'png' | 'charx' | 'voxta' | 'json' | 'unknown'
// result.confidence: 'high' | 'medium' | 'low'

// Quick check if buffer might be a card
if (mightBeCard(buffer)) {
  // Worth trying to parse
}
```

### Detection Logic

| Format | Detection Method |
|--------|------------------|
| **PNG** | Starts with PNG signature (89 50 4E 47) |
| **CharX** | ZIP with `card.json` inside |
| **Voxta** | ZIP with `Characters/` folder structure |
| **JSON** | Valid JSON with `name` + `description` or `spec` field |

### Format Priority

When a file could match multiple formats:
1. PNG signature → PNG
2. ZIP with `card.json` → CharX
3. ZIP with Voxta structure → Voxta
4. Valid JSON → JSON
5. Otherwise → unknown

---

## Parsing

### Types

```typescript
interface ExtractedAsset {
  type: 'icon' | 'background' | 'emotion' | 'audio' | 'video' | 'other';
  name: string;
  ext: string;
  data: Uint8Array;
}

interface ParseResult {
  card: CCv3Data;               // Always normalized to CCv3
  assets: ExtractedAsset[];     // Extracted binary assets
  containerFormat: ContainerFormat; // Source container format
  spec: Spec;                   // 'chara_card_v2' | 'chara_card_v3'
  sourceFormat: SourceFormat;   // Source format indicator
  originalShape: unknown;       // Raw JSON before normalization
}

interface ParseOptions {
  maxAssetSize?: number;       // Per-asset size limit (default: 50MB)
  maxTotalSize?: number;       // Total extraction limit
}
```

### Parse Functions

```typescript
import { parseCard, parseCardAsync, getContainerFormat } from '@character-foundry/loader';

// Synchronous parsing
const result = parseCard(buffer);

// Async parsing (better for large files)
const result = await parseCardAsync(buffer, {
  maxAssetSize: 50 * 1024 * 1024,
});

// Just get format without full parse
const format = getContainerFormat(buffer);
```

### What Gets Normalized

All input formats are converted to CCv3:

| Source | Normalization |
|--------|---------------|
| **CCv2** | Fields mapped to CCv3, `extensions` preserved |
| **CCv3** | Passed through as-is |
| **Voxta** | Mapped to CCv3 fields, books merged to `character_book` |

The `spec` and `sourceFormat` fields tell you what the source was:
- `spec: 'chara_card_v2'` - Was TavernCard V2
- `spec: 'chara_card_v3'` - Was CCv3 or compatible
- `sourceFormat` provides more detail (e.g., 'voxta', 'risuai')

The `originalShape` contains the raw JSON object before normalization.

---

## Lorebook Parsing

The loader can parse standalone lorebook files in various formats (SillyTavern world_info, CCv3 character_book, Agnai, etc.).

### Types

```typescript
type LorebookFormat = 'ccv3' | 'sillytavern' | 'agnai' | 'risu' | 'wyvern' | 'unknown';

interface LorebookParseResult {
  type: 'lorebook';                    // Discriminator
  book: CCv3CharacterBook;             // Normalized lorebook
  containerFormat: 'lorebook';
  lorebookFormat: LorebookFormat;      // Detected original format
  originalShape: unknown;              // Raw original data
  rawJson: string;
  rawBuffer: BinaryData;
}
```

### Parsing Lorebooks

```typescript
import { parseLorebook } from '@character-foundry/loader';

// Parse any lorebook format
const result = parseLorebook(buffer);

console.log(result.type);               // 'lorebook'
console.log(result.lorebookFormat);     // 'sillytavern', 'ccv3', etc.
console.log(result.book.entries.length); // Number of entries
```

### Supported Lorebook Formats

| Format | Detection |
|--------|-----------|
| **CCv3** | `entries` array with `keys`/`content` objects |
| **SillyTavern** | `entries` object keyed by uid |
| **Agnai** | `kind: 'memory'` with `keywords`/`entry` format |
| **Risu** | `type: 'risu'` or `ripiVersion` field |
| **Wyvern** | `format: 'wyvern'` or `wyvern` field |

---

## Universal Parser

The `parse()` function handles both character cards and standalone lorebooks, returning a discriminated union.

### Types

```typescript
interface CardParseResult extends ParseResult {
  type: 'card';
}

type UniversalParseResult = CardParseResult | LorebookParseResult;
```

### Usage

```typescript
import { parse } from '@character-foundry/loader';

const result = parse(buffer);

// Type narrowing with discriminator
if (result.type === 'card') {
  // CardParseResult
  console.log(result.card.data.name);
  console.log(result.assets.length);
} else {
  // LorebookParseResult
  console.log(result.book.name);
  console.log(result.book.entries.length);
}
```

### When to Use Each Function

| Function | Use Case |
|----------|----------|
| `parseCard()` | You know it's a character card |
| `parseLorebook()` | You know it's a standalone lorebook |
| `parse()` | Unknown content, could be either |

---

## Usage Examples

### Basic Loading

```typescript
import { parseCard } from '@character-foundry/loader';
import { readFile } from 'fs/promises';

async function loadCharacter(path: string) {
  const buffer = await readFile(path);
  const { card, assets, containerFormat } = parseCard(buffer);

  console.log(`Loaded: ${card.data.name}`);
  console.log(`Format: ${containerFormat}`);
  console.log(`Assets: ${assets.length}`);

  return card;
}
```

### Handle Different Formats

```typescript
import { detectFormat, parseCard } from '@character-foundry/loader';

function loadWithFormatInfo(buffer: Uint8Array) {
  const detection = detectFormat(buffer);

  if (detection.format === 'unknown') {
    throw new Error('Unrecognized file format');
  }

  console.log(`Detected: ${detection.format} (${detection.confidence} confidence)`);

  const result = parseCard(buffer);

  // Format-specific handling
  switch (result.containerFormat) {
    case 'png':
      console.log('Loaded from PNG image');
      break;
    case 'charx':
      console.log(`CharX with ${result.assets.length} assets`);
      break;
    case 'voxta':
      console.log('Loaded from Voxta package');
      break;
    case 'json':
      console.log('Loaded from raw JSON');
      break;
  }

  return result;
}
```

### Extract Avatar

```typescript
import { parseCard } from '@character-foundry/loader';

function getAvatar(buffer: Uint8Array): Uint8Array | null {
  const { card, assets } = parseCard(buffer);

  // Check extracted assets
  const iconAsset = assets.find(a => a.type === 'icon');
  if (iconAsset) return iconAsset.data;

  // Check asset descriptors (might be data URI)
  const iconDesc = card.data.assets?.find(a => a.type === 'icon');
  if (iconDesc?.uri.startsWith('data:')) {
    // Parse data URI
    const base64 = iconDesc.uri.split(',')[1];
    return base64Decode(base64);
  }

  return null;
}
```

### Batch Processing

```typescript
import { parseCard, mightBeCard } from '@character-foundry/loader';
import { readdir, readFile } from 'fs/promises';

async function loadAllCards(directory: string) {
  const files = await readdir(directory);
  const cards = [];

  for (const file of files) {
    try {
      const buffer = await readFile(`${directory}/${file}`);

      if (!mightBeCard(buffer)) {
        console.log(`Skipping ${file}: not a card`);
        continue;
      }

      const { card, containerFormat } = parseCard(buffer);
      cards.push({ file, card, containerFormat });
      console.log(`Loaded: ${card.data.name} (${containerFormat})`);
    } catch (err) {
      console.error(`Failed to load ${file}:`, err);
    }
  }

  return cards;
}
```

### Preserve Original Shape for Round-Trip

```typescript
import { parseCard } from '@character-foundry/loader';
import { exportCard } from '@character-foundry/exporter';

async function roundTrip(buffer: Uint8Array, newFormat: 'png' | 'charx') {
  // Load (normalizes to CCv3)
  const { card, assets, spec } = parseCard(buffer);

  // Modify
  card.data.description = 'Updated description';

  // Export to new format
  const output = exportCard(card, assets, { format: newFormat });

  // Or export back to original format
  // (use spec to decide v2 vs v3 JSON structure if needed)

  return output;
}
```

### Handle Large Files

```typescript
import { parseCardAsync } from '@character-foundry/loader';

async function loadLargeCard(buffer: Uint8Array) {
  const result = await parseCardAsync(buffer, {
    maxAssetSize: 100 * 1024 * 1024,  // 100MB per asset
    maxTotalSize: 500 * 1024 * 1024,  // 500MB total
  });

  return result;
}
```

---

## Error Handling

```typescript
import { parseCard } from '@character-foundry/loader';
import { ParseError, SizeLimitError } from '@character-foundry/core';

function safeLoad(buffer: Uint8Array) {
  try {
    return parseCard(buffer);
  } catch (err) {
    if (err instanceof ParseError) {
      console.error(`Parse error: ${err.message}`);
      // Invalid format, corrupted data, etc.
    } else if (err instanceof SizeLimitError) {
      console.error(`File too large: ${err.actual} > ${err.limit}`);
    } else {
      throw err;
    }
    return null;
  }
}
```

---

## Integration with Other Packages

The loader is typically used with the exporter for full round-trip:

```typescript
import { parseCard } from '@character-foundry/loader';
import { exportCard, checkExportLoss } from '@character-foundry/exporter';

async function convertCard(
  input: Uint8Array,
  outputFormat: 'png' | 'charx' | 'voxta'
) {
  // Load any format
  const { card, assets } = parseCard(input);

  // Check for data loss
  const loss = checkExportLoss(card, outputFormat);
  if (loss.lostFields.length > 0) {
    console.warn('Warning: Some fields will be lost:', loss.lostFields);
  }

  // Export to target format
  return exportCard(card, assets, { format: outputFormat });
}
```

---

## Server-side Metadata Validation

Validates client-provided metadata against actual parsed card data, enabling optimistic UI while maintaining server authority.

### Use Cases

1. **Optimistic UI uploads** - Client computes metadata locally for instant UI feedback, server validates
2. **Upload validation** - Ensure client-submitted token counts and hashes are accurate
3. **Federation inbox validation** - Verify metadata from remote instances

### Types

```typescript
interface ClientMetadata {
  name: string;
  description?: string;
  tokens: Partial<TokenCounts>;
  contentHash: string;
  tags?: string[];
  hasLorebook: boolean;
  lorebookEntriesCount: number;
}

interface TokenCounts {
  description: number;
  personality: number;
  scenario: number;
  firstMes: number;
  mesExample: number;
  systemPrompt: number;
  postHistoryInstructions: number;
  alternateGreetings: number;
  lorebook: number;
  creatorNotes: number;
  total: number;
}

interface ValidationResult {
  isValid: boolean;              // No significant discrepancies
  isTrusted: boolean;            // No discrepancies at all
  discrepancies: MetadataDiscrepancy[];
  authoritative: AuthoritativeMetadata;
  warnings: string[];
  errors: string[];
}

interface AuthoritativeMetadata {
  name: string;
  tokens: TokenCounts;
  contentHash: string;
  hasLorebook: boolean;
  lorebookEntriesCount: number;
}
```

### Basic Usage

```typescript
import { parseCard, validateClientMetadata } from '@character-foundry/loader';
import { countCardTokens } from '@character-foundry/tokenizers';

// Client sends metadata with upload
const clientMeta: ClientMetadata = {
  name: 'My Character',
  tokens: { description: 150, total: 500 },
  contentHash: 'abc123...',
  hasLorebook: true,
  lorebookEntriesCount: 5,
};

// Server parses and validates
const parseResult = parseCard(buffer);
const result = await validateClientMetadata(clientMeta, parseResult, {
  countTokens: (card) => countCardTokens(card),
  tokenTolerance: 0.05, // 5% tolerance
});

if (!result.isValid) {
  console.warn('Metadata discrepancies:', result.discrepancies);
  console.error('Errors:', result.errors);
}

// Always use authoritative values for storage
await db.insert({
  ...clientMeta,
  tokens: result.authoritative.tokens,
  contentHash: result.authoritative.contentHash,
});
```

### Validation Options

```typescript
interface ValidationOptions {
  // Tolerance for token count differences (default: 5%)
  tokenTolerance?: number;

  // Allow hash mismatches without marking as invalid (default: false)
  allowHashMismatch?: boolean;

  // Custom tag validation function
  validateTags?: (tags: string[]) => {
    valid: boolean;
    filtered: string[];
    reason?: string;
  };

  // Custom token counter (from @character-foundry/tokenizers)
  countTokens?: (card: CCv3Data) => TokenCounts;

  // Custom content hash function
  computeHash?: (content: string) => Promise<string> | string;
}
```

### Synchronous Validation

For environments where async is not available:

```typescript
import { validateClientMetadataSync, type SyncValidationOptions } from '@character-foundry/loader';
import { createHash } from 'crypto';

const options: SyncValidationOptions = {
  countTokens: (card) => countCardTokens(card),
  computeHash: (content) => createHash('sha256').update(content).digest('hex'),
};

const result = validateClientMetadataSync(clientMeta, parseResult, options);
```

### Compute Content Hash

Standalone utility to compute the canonical content hash:

```typescript
import { computeContentHash } from '@character-foundry/loader';

const hash = await computeContentHash(card);
// SHA-256 hash of canonical JSON representation
```

### Discrepancy Handling

```typescript
interface MetadataDiscrepancy {
  field: string;           // e.g., 'tokens.description', 'contentHash', 'name'
  clientValue: unknown;
  computedValue: unknown;
  withinTolerance: boolean;
}

// Example: Check specific discrepancies
const result = await validateClientMetadata(clientMeta, parseResult);

for (const disc of result.discrepancies) {
  if (disc.field === 'contentHash' && !disc.withinTolerance) {
    console.error('Content hash mismatch - possible tampering');
  }
  if (disc.field.startsWith('tokens.') && disc.withinTolerance) {
    console.log(`Token count for ${disc.field} within tolerance`);
  }
}
```

### Cloudflare Workers Example

```typescript
import { parseCard, validateClientMetadata } from '@character-foundry/loader';
import { countCardTokens } from '@character-foundry/tokenizers';

export default {
  async fetch(request: Request): Promise<Response> {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const metadata = JSON.parse(formData.get('metadata') as string);

    const buffer = new Uint8Array(await file.arrayBuffer());
    const parseResult = parseCard(buffer);

    const validation = await validateClientMetadata(metadata, parseResult, {
      countTokens: countCardTokens,
      tokenTolerance: 0.05,
    });

    if (!validation.isValid) {
      return new Response(JSON.stringify({
        error: 'Metadata validation failed',
        discrepancies: validation.discrepancies,
        errors: validation.errors,
      }), { status: 400 });
    }

    // Use authoritative metadata
    const trustedData = {
      name: validation.authoritative.name,
      tokens: validation.authoritative.tokens,
      contentHash: validation.authoritative.contentHash,
    };

    // Store in database...
    return new Response(JSON.stringify({ success: true, data: trustedData }));
  },
};
```
