# @character-foundry/loader

Universal character card loader with automatic format detection.

## Installation

```bash
npm install @character-foundry/loader
```

## Features

- **Auto-detection** - PNG, CharX, Voxta, JSON formats
- **Normalization** - Always returns CCv3 format
- **Asset extraction** - Images, audio, and other assets
- **Lorebook parsing** - Standalone lorebook support

## Quick Start

```typescript
import { parseCard, parseLorebook, parse } from '@character-foundry/loader';

// Load any character card format
const result = parseCard(buffer);
// result.card: CCv3Data (always normalized to v3)
// result.assets: ExtractedAsset[]
// result.containerFormat: 'png' | 'charx' | 'voxta' | 'json'
// result.spec: 'chara_card_v2' | 'chara_card_v3'

console.log(result.card.data.name);

// Parse standalone lorebook
const { book, originalFormat } = parseLorebook(jsonBuffer);

// Universal parse (cards or lorebooks)
const parsed = parse(buffer);
if (parsed.type === 'card') {
  console.log(parsed.card.data.name);
} else {
  console.log(parsed.book.name);
}
```

## Documentation

See [docs/loader.md](../../docs/loader.md) for full API documentation.

## License

MIT
