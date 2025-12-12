# Character Foundry

A universal TypeScript library for reading, writing, and converting AI character card formats.

## Supported Formats

| Format | Read | Write | Notes |
|--------|------|-------|-------|
| PNG (TavernCard v2/v3) | ✅ | ✅ | tEXt/zTXt chunk embedding |
| CharX (Risu) | ✅ | ✅ | ZIP-based, JPEG+ZIP hybrids |
| Voxta (.voxpkg) | ✅ | ✅ | Multi-character packages |
| Raw JSON | ✅ | ✅ | CCv2/CCv3 direct |
| Standalone Lorebooks | ✅ | ✅ | SillyTavern, Agnai, Risu, Wyvern |

## Quick Start

```bash
pnpm add @character-foundry/character-foundry
```

```typescript
import { parseCard, exportCard } from '@character-foundry/character-foundry';

// Load any format
const { card, assets, format } = parseCard(buffer);
console.log(card.data.name); // Character name

// Export to different format
const pngBuffer = exportCard(card, assets, { format: 'png' });
```

Or import from specific packages:

```typescript
import { parseCard } from '@character-foundry/loader';
import { exportCard } from '@character-foundry/exporter';
import { readVoxta } from '@character-foundry/voxta';
```

## Packages

| Package | Version | Description | Docs |
|---------|---------|-------------|------|
| **`@character-foundry/character-foundry`** | **0.1.1** | **Meta package - installs everything** | - |
| `@character-foundry/core` | 0.0.3 | Binary utilities, base64, ZIP, URI parsing, security | [docs/core.md](docs/core.md) |
| `@character-foundry/schemas` | 0.1.1 | CCv2, CCv3, Voxta types + detection + CardNormalizer | [docs/schemas.md](docs/schemas.md) |
| `@character-foundry/png` | 0.0.4 | PNG chunk handling, metadata stripping, inflate protection | [docs/png.md](docs/png.md) |
| `@character-foundry/charx` | 0.0.4 | CharX reader/writer, JPEG+ZIP support | [docs/charx.md](docs/charx.md) |
| `@character-foundry/voxta` | 0.1.8 | Voxta packages, multi-character, scenarios, collections, merge utilities | [docs/voxta.md](docs/voxta.md) |
| `@character-foundry/lorebook` | 0.0.2 | Lorebook parsing, extraction, insertion | [docs/lorebook.md](docs/lorebook.md) |
| `@character-foundry/loader` | 0.1.8 | Universal `parseCard()` + `parseLorebook()` + `parse()` with format detection | [docs/loader.md](docs/loader.md) |
| `@character-foundry/exporter` | 0.1.2 | Universal `exportCard()` with loss reporting | [docs/exporter.md](docs/exporter.md) |
| `@character-foundry/normalizer` | 0.1.2 | v2 → v3 conversion | [docs/normalizer.md](docs/normalizer.md) |
| `@character-foundry/tokenizers` | 0.1.1 | GPT-4/LLaMA token counting + card field counting | [docs/tokenizers.md](docs/tokenizers.md) |
| `@character-foundry/media` | 0.1.1 | Image format detection, dimensions, thumbnail generation | [docs/media.md](docs/media.md) |
| `@character-foundry/federation` | 0.1.6 | ActivityPub federation + HTTP signatures + D1 store (experimental) | [docs/federation.md](docs/federation.md) |

## Installation

Packages are published to **GitHub Packages**. Configure your `.npmrc`:

```ini
@character-foundry:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Then install everything:

```bash
pnpm add @character-foundry/character-foundry
```

Or install individual packages:

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

### Lorebook Management

```typescript
import {
  parseLorebook,
  getLorebookCollection,
  extractLorebookRefs,
  createLinkedLorebook,
  addLinkedLorebookToCard,
  serializeLorebook,
} from '@character-foundry/lorebook';

// Parse standalone lorebook (auto-detects format)
const { book, originalFormat } = parseLorebook(jsonBuffer);

// Extract lorebook collection from card (keeps them separate!)
const collection = getLorebookCollection(card);
// collection.embedded: CCv3CharacterBook[] (multiple allowed)
// collection.linked: LinkedLorebook[] (with source tracking)

// Find linked lorebook references in card extensions
const refs = extractLorebookRefs(card);
// refs: [{ url, platform, id, name }, ...]

// After fetching a linked lorebook, stamp and add it
const linked = createLinkedLorebook(fetchedBook, sourceUrl, 'chub');
const updatedCard = addLinkedLorebookToCard(card, linked);

// Convert back to original format for export
const json = serializeLorebook(book, 'sillytavern');
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
import { countTokens, registry } from '@character-foundry/tokenizers';

// Quick count
const tokens = countTokens('Hello, world!', 'gpt-4');

// Use tokenizer directly
const tokenizer = registry.get('gpt-4');
const count = tokenizer.count(card.data.description);
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

### Version Conversion

```typescript
import { ccv2ToCCv3, ccv3ToCCv2Wrapped, checkV3ToV2Loss } from '@character-foundry/normalizer';

// V2 → V3 (lossless)
const v3Card = ccv2ToCCv3(v2Card);

// V3 → V2 (check for loss first)
const lostFields = checkV3ToV2Loss(v3Card);
const v2Card = ccv3ToCCv2Wrapped(v3Card);
```

## Documentation

Detailed documentation for each package:

- **[Core](docs/core.md)** - Binary utilities, base64, ZIP, URI, errors
- **[Schemas](docs/schemas.md)** - CCv2, CCv3, Risu types and detection
- **[PNG](docs/png.md)** - PNG chunk parsing and building
- **[CharX](docs/charx.md)** - CharX format, JPEG+ZIP hybrids
- **[Voxta](docs/voxta.md)** - Multi-character packages, merge utilities
- **[Lorebook](docs/lorebook.md)** - Lorebook parsing, extraction, insertion
- **[Loader](docs/loader.md)** - Universal loading with format detection
- **[Exporter](docs/exporter.md)** - Universal export with loss detection
- **[Normalizer](docs/normalizer.md)** - V2 ↔ V3 ↔ NormalizedCard conversion
- **[Tokenizers](docs/tokenizers.md)** - GPT-4/LLaMA token counting
- **[Media](docs/media.md)** - Image format detection, dimensions, thumbnails
- **[Federation](docs/federation.md)** - ActivityPub federation (experimental)

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests (476 tests)
pnpm test

# Typecheck
pnpm typecheck
```

## Security

- **ZIP preflight** - Validates uncompressed sizes before decompression (zip bomb protection)
- **PNG inflate cap** - Limits zTXt/iTXt decompression to 50MB
- **50MB per-asset limit** enforced across all parsers
- **Secure UUID** - crypto.randomUUID() with fallback for non-secure contexts
- **Data URL validation** - Safe parsing with size limits
- **Federation gated** - must call `enableFederation()` explicitly
- **Size checks** before base64 decode to prevent memory exhaustion
- **Path traversal protection** in ZIP extraction

## License

MIT
