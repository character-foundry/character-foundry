# @character-foundry/normalizer

V2 to V3 character card conversion with loss detection.

## Installation

```bash
npm install @character-foundry/normalizer
```

## Features

- **V2 to V3** - Lossless upgrade
- **V3 to V2** - Downgrade with loss detection
- **NormalizedCard** - Simplified internal format

## Quick Start

```typescript
import {
  ccv2ToCCv3,
  ccv3ToCCv2Wrapped,
  checkV3ToV2Loss,
  normalize,
  denormalize,
} from '@character-foundry/normalizer';

// V2 → V3 (lossless)
const v3Card = ccv2ToCCv3(v2Card);

// V3 → V2 (check for loss first)
const lostFields = checkV3ToV2Loss(v3Card);
if (lostFields.length > 0) {
  console.warn('Will lose:', lostFields);
}
const v2Card = ccv3ToCCv2Wrapped(v3Card);

// Work with simplified format
const normalized = normalize(v3Card);
// Edit normalized.name, normalized.description, etc.
const backToV3 = denormalize(normalized);
```

## Documentation

See [docs/normalizer.md](../../docs/normalizer.md) for full API documentation.

## License

MIT
