# @character-foundry/character-foundry

Universal TypeScript library for reading, writing, and converting AI character card formats.

**This is the meta package** - it installs all Character Foundry packages.

## Installation

```bash
npm install @character-foundry/character-foundry
```

## Quick Start

```typescript
import { parseCard, exportCard } from '@character-foundry/character-foundry';

// Load any format (PNG, CharX, Voxta, JSON)
const { card, assets, format } = parseCard(buffer);
console.log(card.data.name);

// Export to different format
const pngBuffer = exportCard(card, assets, 'png');
```

## Included Packages

| Package | Description |
|---------|-------------|
| `core` | Binary utilities, ZIP, base64, security |
| `schemas` | CCv2, CCv3, Voxta types + Zod validation |
| `png` | PNG chunk handling, metadata embedding |
| `charx` | CharX format, JPEG+ZIP hybrids |
| `voxta` | Multi-character packages, scenarios |
| `lorebook` | Lorebook parsing and conversion |
| `loader` | Universal parseCard() with format detection |
| `exporter` | Universal exportCard() with loss detection |
| `normalizer` | V2 ↔ V3 conversion |
| `tokenizers` | GPT-4/LLaMA token counting |
| `media` | Image format detection, thumbnails |
| `federation` | ActivityPub federation (experimental) |
| `app-framework` | Schema-driven UI with AutoForm |

## Subpath Imports

```typescript
// Import specific packages
import { parseCard } from '@character-foundry/character-foundry/loader';
import { countTokens } from '@character-foundry/character-foundry/tokenizers';
import { CCv3DataSchema } from '@character-foundry/character-foundry/schemas';
```

## Supported Formats

| Format | Read | Write |
|--------|------|-------|
| PNG (TavernCard v2/v3) | ✅ | ✅ |
| CharX (Risu) | ✅ | ✅ |
| Voxta (.voxpkg) | ✅ | ✅ |
| Raw JSON | ✅ | ✅ |
| Standalone Lorebooks | ✅ | ✅ |

## Documentation

- [Full documentation](../../docs/)
- [GitHub repository](https://github.com/character-foundry/character-foundry)

## License

MIT
