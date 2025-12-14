# @character-foundry/png

PNG chunk handling for AI character cards with tEXt/zTXt metadata embedding.

## Installation

```bash
npm install @character-foundry/png
```

## Features

- **Read PNG metadata** - Extract tEXt/zTXt chunks
- **Write PNG metadata** - Embed character data in PNG
- **Metadata stripping** - Remove tEXt/zTXt for clean images
- **Inflate protection** - 50MB decompression limit

## Quick Start

```typescript
import {
  readPngChunks,
  writePngChunks,
  stripPngMetadata,
  extractPngText,
} from '@character-foundry/png';

// Read all chunks
const chunks = readPngChunks(pngBuffer);

// Extract text metadata
const textChunks = extractPngText(pngBuffer);
// { chara: '...base64...', ... }

// Write character data
const newPng = writePngChunks(pngBuffer, {
  chara: base64EncodedJson,
});

// Strip metadata for clean thumbnail
const cleanPng = stripPngMetadata(pngBuffer);
```

## Documentation

See [docs/png.md](../../docs/png.md) for full API documentation.

## License

MIT
