# Character Foundry

A universal TypeScript library for reading, writing, and converting AI character card formats.

## Supported Formats

| Format | Read | Write | Notes |
|--------|------|-------|-------|
| PNG (TavernCard v2/v3) | ✅ | ✅ | tEXt/zTXt chunk embedding |
| CharX (Risu) | ✅ | ✅ | ZIP-based, JPEG+ZIP hybrids |
| Voxta (.voxpkg) | ✅ | ✅ | Multi-character packages |
| Raw JSON | ✅ | ✅ | CCv2/CCv3 direct |

## Quick Start

```typescript
import { parseCard } from '@character-foundry/loader';
import { exportCard } from '@character-foundry/exporter';

// Load any format
const { card, assets, format } = parseCard(buffer);
console.log(card.data.name); // Character name

// Export to different format
const pngBuffer = exportCard(card, assets, { format: 'png' });
```

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| `@character-foundry/core` | 0.0.1 | Binary utilities, base64, ZIP, URI parsing |
| `@character-foundry/schemas` | 0.0.1 | CCv2, CCv3, Voxta types + detection |
| `@character-foundry/png` | 0.0.2 | PNG chunk handling, metadata stripping |
| `@character-foundry/charx` | 0.0.2 | CharX reader/writer, JPEG+ZIP support |
| `@character-foundry/voxta` | 0.1.0 | Voxta packages, merge utilities |
| `@character-foundry/loader` | 0.1.2 | Universal `parseCard()` with format detection |
| `@character-foundry/exporter` | 0.1.0 | Universal `exportCard()` with loss reporting |
| `@character-foundry/normalizer` | 0.1.0 | v2 → v3 conversion |
| `@character-foundry/tokenizers` | 0.0.1 | GPT-4/LLaMA token counting |
| `@character-foundry/federation` | 0.1.1 | ActivityPub federation (experimental) |

## Installation

Packages are published to **GitHub Packages**. Configure your `.npmrc`:

```ini
@character-foundry:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Then install:

```bash
pnpm add @character-foundry/loader @character-foundry/exporter
```

## Features

### Universal Loader

```typescript
import { parseCard } from '@character-foundry/loader';

// Handles PNG, CharX, Voxta, JSON automatically
const result = parseCard(buffer);

// result.format: 'png' | 'charx' | 'voxta' | 'json'
// result.card: CCv3Data (always normalized to v3)
// result.assets: Asset[] (extracted images, audio, etc.)
// result.originalShape: 'v2' | 'v3' (original format)
```

### Voxta Multi-Character Support

```typescript
import { readVoxta, getPackageManifest, mergeCharacterEdits } from '@character-foundry/voxta';

// Read multi-character package
const data = readVoxta(buffer);
const manifest = getPackageManifest(data);
// manifest.characters: [{ id, name }, ...]
// manifest.books: [{ id, name, usedBy: [charIds] }, ...]

// Edit and save with delta export (only changed files)
const updated = mergeCharacterEdits(data.characters[0], edits);
const newBuffer = applyVoxtaDeltas(buffer, {
  characters: new Map([[updated.Id, updated]])
});
```

### Token Counting

```typescript
import { createTokenizer, countCardTokens } from '@character-foundry/tokenizers';

const tokenizer = createTokenizer('gpt4');
const counts = countCardTokens(card, tokenizer);
// counts.description, counts.personality, counts.total, etc.
```

### Format Conversion with Loss Detection

```typescript
import { exportCard, checkExportLoss } from '@character-foundry/exporter';

const loss = checkExportLoss(card, 'png');
if (loss.lostFields.length > 0) {
  console.warn('Will lose:', loss.lostFields);
}

const buffer = exportCard(card, assets, { format: 'png' });
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests (237 tests)
pnpm test

# Typecheck
pnpm typecheck
```

## Security

- **50MB per-asset limit** enforced across all parsers
- **Federation gated** - must call `enableFederation()` explicitly
- **Size checks** before base64 decode to prevent memory exhaustion

## License

MIT
