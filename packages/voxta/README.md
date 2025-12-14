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
  writeVoxta,
  getPackageManifest,
  mergeCharacterEdits,
} from '@character-foundry/voxta';

// Read package
const data = readVoxta(buffer);
const manifest = getPackageManifest(data);
// manifest.characters: [{ id, name }, ...]
// manifest.books: [{ id, name, usedBy: [charIds] }, ...]

// Edit character
const updated = mergeCharacterEdits(data.characters[0], {
  Name: 'New Name',
  Description: 'Updated description',
});

// Write back
const newBuffer = writeVoxta(data, { includePackageJson: true });
```

## Documentation

See [docs/voxta.md](../../docs/voxta.md) for full API documentation.

## License

MIT
