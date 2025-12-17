# @character-foundry/charx

CharX format reader/writer with JPEG+ZIP hybrid support for AI character cards.

## Installation

```bash
npm install @character-foundry/charx
```

## Features

- **Read CharX** - Extract card.json and assets from ZIP
- **Write CharX** - Create CharX archives
- **JPEG+ZIP hybrids** - Support for Risu's hybrid format
- **Multi-asset support** - Icons, backgrounds, expressions

## Quick Start

```typescript
import { isCharX, isJpegCharX, readCharX, writeCharX } from '@character-foundry/charx';

// Read CharX file
const { card, assets, isRisuFormat } = readCharX(buffer);
console.log(card.data.name);

// Write CharX file (supply CharxWriteAsset[] that you want embedded)
const charxBuffer = writeCharX(card, [], {
  spec: 'v3',
  compressionLevel: 6,
});

// Check for JPEG+ZIP hybrid
if (isJpegCharX(buffer)) {
  // Handle hybrid format
}
```

## Documentation

See [docs/charx.md](../../docs/charx.md) for full API documentation.

## License

MIT
