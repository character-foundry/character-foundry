# Character Foundry
![Gemini_Generated_Image_w1vez7w1vez7w1ve (1)](https://github.com/user-attachments/assets/d07748a2-a21e-4331-9608-4c0543080bba)

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
import { parseCard } from '@character-foundry/character-foundry/loader';
import { exportCard } from '@character-foundry/character-foundry/exporter';

// Load any format
const { card, assets, containerFormat } = parseCard(buffer);
console.log(card.data.name); // Character name

// Export to different format
const pngBuffer = exportCard(card, assets, { format: 'png' });
```

All functionality is available via subpath exports:

```typescript
import { parseCard } from '@character-foundry/character-foundry/loader';
import { exportCard } from '@character-foundry/character-foundry/exporter';
import { readVoxta } from '@character-foundry/character-foundry/voxta';
import { CCv3Data } from '@character-foundry/character-foundry/schemas';
```

## Packages

| Package | Version | Description | Docs |
|---------|---------|-------------|------|
| **`@character-foundry/character-foundry`** | **0.4.2** | **Main library - all functionality bundled** | - |
| **`@character-foundry/cli`** | **0.4.2** | **CLI tool** | [docs/cli.md](docs/cli.md) |

### Internal Packages (bundled, not published separately)

| Package | Description | Docs |
|---------|-------------|------|
| `core` | Binary utilities, base64, ZIP, URI parsing, security | [docs/core.md](docs/core.md) |
| `schemas` | CCv2, CCv3, Voxta types + Zod schemas + runtime validation | [docs/schemas.md](docs/schemas.md) |
| `png` | PNG chunk handling, metadata stripping, inflate protection | [docs/png.md](docs/png.md) |
| `charx` | CharX reader/writer, JPEG+ZIP support | [docs/charx.md](docs/charx.md) |
| `voxta` | Voxta packages, multi-character, scenarios, collections, merge utilities | [docs/voxta.md](docs/voxta.md) |
| `lorebook` | Lorebook parsing, extraction, insertion | [docs/lorebook.md](docs/lorebook.md) |
| `loader` | Universal `parseCard()` + `parseLorebook()` + `parse()` with format detection | [docs/loader.md](docs/loader.md) |
| `exporter` | Universal `exportCard()` with loss reporting | [docs/exporter.md](docs/exporter.md) |
| `normalizer` | v2 → v3 conversion | [docs/normalizer.md](docs/normalizer.md) |
| `tokenizers` | GPT-4/LLaMA token counting + card field counting | [docs/tokenizers.md](docs/tokenizers.md) |
| `media` | Image format detection, dimensions, thumbnail generation | [docs/media.md](docs/media.md) |
| `image-utils` | Image URL extraction, SSRF protection, safety checks | - |
| `federation` | ActivityPub federation + HTTP signatures + D1 store (gated, opt-in) | [docs/federation.md](docs/federation.md) |
| `app-framework` | Schema-driven UI: Extension, Registry, AutoForm (React peer dep) | [docs/app-framework.md](docs/app-framework.md) |

## Installation

```bash
# Stable release
npm install @character-foundry/character-foundry

# Development release (latest features, may be unstable)
npm install @character-foundry/character-foundry@dev
```

For CLI:

```bash
npm install -g @character-foundry/cli
```

## Features

### Runtime Validation with Zod

```typescript
import { CCv3DataSchema, parseV3Card, isV3Card, safeParse } from '@character-foundry/character-foundry/schemas';

// Type guard with runtime validation
if (isV3Card(unknownData)) {
  // Data is validated CCv3Data
  console.log(unknownData.data.name);
}

// Parse with validation (throws on invalid data)
const card = parseV3Card(jsonData);

// Safe parse with detailed errors
const result = safeParse(CCv3DataSchema, data);
if (result.success) {
  console.log(result.data);
} else {
  console.error(`Validation failed: ${result.error}`);
  console.error(`Field: ${result.field}`);
}
```

### Universal Loader

```typescript
import { parseCard } from '@character-foundry/character-foundry/loader';

// Handles PNG, CharX, Voxta, JSON automatically
const result = parseCard(buffer);

// result.containerFormat: 'png' | 'charx' | 'voxta' | 'json'
// result.card: CCv3Data (always normalized to v3)
// result.assets: ExtractedAsset[] (extracted images, audio, etc.)
// result.spec: 'chara_card_v2' | 'chara_card_v3' (detected spec version)
// result.sourceFormat: 'ccv2' | 'ccv3' | 'voxta' | ... (source format indicator)
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
} from '@character-foundry/character-foundry/lorebook';

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
import { readVoxta, getPackageManifest, mergeCharacterEdits, applyVoxtaDeltas } from '@character-foundry/character-foundry/voxta';

// Read multi-character package
const data = readVoxta(buffer);
const manifest = getPackageManifest(data);
// manifest.characters: [{ id, name }, ...]
// manifest.books: [{ id, name, usedBy: [charIds] }, ...]

// Edit and save with delta export (only changed files)
const charId = data.characters[0]!.id;
const updated = mergeCharacterEdits(data.characters[0]!, {
  name: 'New Name',
  description: 'Updated description',
});
const newBuffer = applyVoxtaDeltas(buffer, {
  characters: new Map([[charId, updated]]),
});
```

### Token Counting

```typescript
import { countTokens, registry } from '@character-foundry/character-foundry/tokenizers';

// Quick count
const tokens = countTokens('Hello, world!', 'gpt-4');

// Use tokenizer directly
const tokenizer = registry.get('gpt-4');
const count = tokenizer.count(card.data.description);
```

### Format Conversion with Loss Detection

```typescript
import { exportCard, checkExportLoss } from '@character-foundry/character-foundry/exporter';

const loss = checkExportLoss(card, 'png');
if (loss.lostFields.length > 0) {
  console.warn('Will lose:', loss.lostFields);
}

const buffer = exportCard(card, assets, { format: 'png' });
```

### Version Conversion

```typescript
import { ccv2ToCCv3, ccv3ToCCv2Wrapped, checkV3ToV2Loss } from '@character-foundry/character-foundry/normalizer';

// V2 → V3 (lossless)
const v3Card = ccv2ToCCv3(v2Card);

// V3 → V2 (check for loss first)
const lostFields = checkV3ToV2Loss(v3Card);
const v2Card = ccv3ToCCv2Wrapped(v3Card);
```

## Documentation

Detailed documentation for each package:

- **[Upgrade Guide](docs/upgrade-guide.md)** - Implementation notes for recent changes (hash v2, federation network key, etc.)
- **[Release Notes](docs/release-notes.md)** - Changesets-based release notes workflow
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
- **[CLI](docs/cli.md)** - Command-line tool for character cards
- **[Federation](docs/federation.md)** - ActivityPub federation (gated, opt-in)
- **[App Framework](docs/app-framework.md)** - Schema-driven UI with AutoForm

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests (~630 tests)
pnpm test

# Typecheck
pnpm typecheck
```

## Contributing

We use a branch-based workflow with automated releases:

### Branch Strategy

```
feature/* → dev → master
            ↓       ↓
         @dev    @latest (npm tags)
```

- **`feature/*`**: Feature branches for development
- **`dev`**: Integration branch, auto-publishes to `@dev` npm tag
- **`master`**: Production branch, releases to `@latest` npm tag

### Making Changes

1. Create a feature branch from `dev`:
   ```bash
   git checkout dev
   git checkout -b feature/my-feature
   ```

2. Make your changes and commit

3. Add a changeset describing your changes:
   ```bash
   pnpm changeset
   # Select packages, change type (patch/minor/major), and describe
   ```

4. Push and create PR to `dev`

5. After merge to `dev`:
   - CI runs tests
   - Auto-publishes to `@dev` npm tag
   - Test with `npm install @character-foundry/character-foundry@dev`

6. When ready for production: PR from `dev` → `master`
   - Changesets bot creates a Release PR
   - Merge Release PR to publish to npm `@latest`

### Commit Guidelines

We use [Changesets](https://github.com/changesets/changesets) for versioning. Run `pnpm changeset` after making changes to create a changeset file describing your changes.

## Security

### Core Protection

- **ZIP preflight** - Validates uncompressed sizes before decompression (zip bomb protection)
- **Streaming ZIP protection** - Tracks actual decompressed bytes during extraction, aborts if limits exceeded
- **Path traversal protection** - Configurable handling: `'skip'` (default), `'warn'`, or `'reject'` modes
- **PNG inflate cap** - Limits zTXt/iTXt decompression to 50MB
- **50MB per-asset limit** enforced across all parsers
- **Secure UUID** - crypto.randomUUID() with fallback for non-secure contexts
- **Data URL validation** - Safe parsing with size limits
- **Size checks** before base64 decode to prevent memory exhaustion

### Federation Security (Opt-in)

- **Gated by default** - must call `enableFederation()` explicitly
- **HTTP signature strict mode** - Enforces `(request-target)`, `host`, `date` headers (opt-in)
- **Optional network key gate** - Require `X-Foundry-Network-Key` for internal-only federation
- **Secure hashing** - SHA-256 change detection for cross-system sync (opt-in)
- **SSRF protection** - Validates resource IDs to prevent path traversal and protocol injection
- **Sync mutex** - Prevents concurrent sync operations from overlapping

See [docs/federation.md](docs/federation.md) for security configuration details.

## License

MIT
