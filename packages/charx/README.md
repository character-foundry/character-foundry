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

## Preserving authored descriptors

Use `writeCharX(card, assets, { preserveDescriptors: true })` when identity depends
on the existing `card.data.assets` metadata. Supply exactly one byte asset per
original descriptor in the same order, with identical `type`, `name` and `ext`.
The writer changes only descriptor URIs, retains opaque fields and display names,
and allocates distinct safe ZIP paths even when names collide after sanitization.
It rejects missing, extra, reordered or relabeled bindings instead of guessing.
A missing descriptor list stays missing when no assets are supplied.

Without this option the writer retains its existing generated-descriptor behavior.
The high-level `exportToCharx` API accepts the same option. Neither API computes
lineage or proves identity by itself; verify actual output content and asset bytes
before claiming a preserving export. Inputs are JSON card data, and callers remain
responsible for existing asset correspondence and implicit portrait semantics.
