# @character-foundry/voxta

Voxta package (.voxpkg) reader/writer with multi-character and scenario support.

## Installation

```bash
npm install @character-foundry/voxta
```

## Features

- **Multi-character packages** - Read/write packages with multiple characters
- **Scenario support** - Full VoxtaScenario with Roles, Events, Contexts
- **Delta exports** - Update packages with minimal changes
- **Lorebook preservation** - Maintain character book associations

## Quick Start

```typescript
import {
  readVoxta,
  getPackageManifest,
  mergeCharacterEdits,
  applyVoxtaDeltas,
  writeVoxta,
} from '@character-foundry/voxta';

// Read package
const data = readVoxta(buffer);
const manifest = getPackageManifest(data);
// manifest.characters: [{ id, name }, ...]
// manifest.books: [{ id, name, usedBy: [charIds] }, ...]

// Edit character
const updated = mergeCharacterEdits(data.characters[0], {
  name: 'New Name',
  description: 'Updated description',
});

// Write back (preserves unchanged files bit-for-bit)
const newBuffer = applyVoxtaDeltas(buffer, {
  characters: new Map([[data.characters[0]!.id, updated]]),
});

// Or export a CCv3 card to a new .voxpkg (character-only export)
// (ccv3Card: CCv3Data, voxtaAssets: VoxtaWriteAsset[])
const exported = writeVoxta(ccv3Card, voxtaAssets, { includePackageJson: false });
```

## Documentation

See [docs/voxta.md](../../docs/voxta.md) for full API documentation.

## License

MIT
