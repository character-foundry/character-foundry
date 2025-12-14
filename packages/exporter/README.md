# @character-foundry/exporter

Universal character card exporter with loss detection.

## Installation

```bash
npm install @character-foundry/exporter
```

## Features

- **Multi-format export** - PNG, CharX, Voxta
- **Loss detection** - Preview data loss before conversion
- **Asset handling** - Embed or extract assets
- **V2/V3 support** - Export PNG as v2 for compatibility

## Quick Start

```typescript
import { exportCard, checkExportLoss } from '@character-foundry/exporter';

// Check for data loss before export
const loss = checkExportLoss(card, assets, 'png');
if (!loss.isLossless) {
  console.warn('Fields lost:', loss.lostFields);
  console.warn('Assets lost:', loss.lostAssets);
}

// Export to different formats
const pngBuffer = exportCard(card, assets, 'png');
const charxBuffer = exportCard(card, assets, 'charx');
const voxtaBuffer = exportCard(card, assets, 'voxta');

// Export PNG as v2 for maximum compatibility
const v2Png = exportCard(card, assets, 'png', { exportAsV2: true });
```

## Documentation

See [docs/exporter.md](../../docs/exporter.md) for full API documentation.

## License

MIT
