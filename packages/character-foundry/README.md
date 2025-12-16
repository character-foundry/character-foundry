# @character-foundry/character-foundry

[![npm version](https://img.shields.io/npm/v/@character-foundry/character-foundry.svg)](https://www.npmjs.com/package/@character-foundry/character-foundry)
[![npm downloads](https://img.shields.io/npm/dm/@character-foundry/character-foundry.svg)](https://www.npmjs.com/package/@character-foundry/character-foundry)

Universal TypeScript library for reading, writing, and converting AI character card formats.

## Installation

```bash
# Stable release
npm install @character-foundry/character-foundry

# Development release (latest features, may be unstable)
npm install @character-foundry/character-foundry@dev
```

## Quick Start

```typescript
import { parseCard } from '@character-foundry/character-foundry/loader';
import { exportCard } from '@character-foundry/character-foundry/exporter';

// Load any format (PNG, CharX, Voxta, JSON)
const { card, assets, format } = parseCard(buffer);
console.log(card.data.name);

// Export to different format
const pngBuffer = exportCard(card, assets, { format: 'png' });
```

## Supported Formats

| Format | Read | Write |
|--------|------|-------|
| PNG (TavernCard v2/v3) | ✅ | ✅ |
| CharX (Risu) | ✅ | ✅ |
| Voxta (.voxpkg) | ✅ | ✅ |
| Raw JSON | ✅ | ✅ |
| Standalone Lorebooks | ✅ | ✅ |

## Subpath Imports

All functionality is available via subpath exports:

```typescript
// Core functionality
import { parseCard } from '@character-foundry/character-foundry/loader';
import { exportCard, checkExportLoss } from '@character-foundry/character-foundry/exporter';

// Schemas and validation
import { CCv3DataSchema, isV3Card, parseV3Card } from '@character-foundry/character-foundry/schemas';

// Format-specific
import { readVoxta, mergeCharacterEdits } from '@character-foundry/character-foundry/voxta';
import { readCharX, writeCharX } from '@character-foundry/character-foundry/charx';
import { readPng, writePng } from '@character-foundry/character-foundry/png';

// Utilities
import { countTokens } from '@character-foundry/character-foundry/tokenizers';
import { ccv2ToCCv3, ccv3ToCCv2Wrapped } from '@character-foundry/character-foundry/normalizer';
import { parseLorebook, serializeLorebook } from '@character-foundry/character-foundry/lorebook';
```

## Available Subpaths

| Subpath | Description |
|---------|-------------|
| `/loader` | Universal parseCard() with format detection |
| `/exporter` | Universal exportCard() with loss detection |
| `/schemas` | CCv2, CCv3, Voxta types + Zod validation |
| `/core` | Binary utilities, ZIP, base64, security |
| `/png` | PNG chunk handling, metadata embedding |
| `/charx` | CharX format, JPEG+ZIP hybrids |
| `/voxta` | Multi-character packages, scenarios |
| `/lorebook` | Lorebook parsing and conversion |
| `/normalizer` | V2 ↔ V3 conversion |
| `/tokenizers` | GPT-4/LLaMA token counting |
| `/media` | Image format detection, thumbnails |
| `/image-utils` | Image URL extraction, SSRF protection |
| `/federation` | ActivityPub federation (experimental) |
| `/app-framework` | Schema-driven UI with AutoForm |

## Runtime Validation

```typescript
import { CCv3DataSchema, isV3Card, safeParse } from '@character-foundry/character-foundry/schemas';

// Type guard
if (isV3Card(data)) {
  console.log(data.data.name);
}

// Safe parse with error details
const result = safeParse(CCv3DataSchema, data);
if (!result.success) {
  console.error(`${result.error} at ${result.field}`);
}
```

## CLI Tool

For command-line usage, install the CLI package:

```bash
npm install -g @character-foundry/cli
cf detect card.png
cf info card.png
cf export card.png --to charx
```

## Documentation

- [GitHub Repository](https://github.com/character-foundry/character-foundry)
- [Changelog](https://github.com/character-foundry/character-foundry/blob/master/CHANGELOG.md)

## License

MIT
